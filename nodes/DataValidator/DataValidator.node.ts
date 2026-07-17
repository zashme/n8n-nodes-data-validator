import {
	GenericValue,
	IDataObject,
	IExecuteFunctions,
	INode,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionTypes,
	NodeOperationError,
	jsonParse,
} from 'n8n-workflow';
import Ajv from 'ajv';
import type { Schema, ValidateFunction } from 'ajv';
import ajvErrors from 'ajv-errors';
import addFormats from 'ajv-formats';

const DEFAULT_SCHEMA = {
	type: 'object',
	properties: {
		foo: { type: 'integer' },
		bar: { type: 'string' },
	},
	required: ['foo'],
	additionalProperties: false,
};

function getByPath(source: IDataObject, path: string): unknown {
	return path
		.split('.')
		.reduce<unknown>(
			(value, key) =>
				value !== null && typeof value === 'object' ? (value as IDataObject)[key] : undefined,
			source,
		);
}

function compileSchema(
	node: INode,
	ajv: Ajv,
	rawSchema: unknown,
	itemIndex: number,
): ValidateFunction {
	let schema: Schema;

	if (typeof rawSchema === 'string') {
		schema = jsonParse<Schema>(rawSchema, { errorMessage: 'The JSON Schema is not valid JSON' });
	} else if (rawSchema !== null && typeof rawSchema === 'object') {
		schema = rawSchema as Schema;
	} else {
		throw new NodeOperationError(node, 'The JSON Schema must be a JSON string or object', {
			itemIndex,
		});
	}

	let validate: ValidateFunction;

	try {
		validate = ajv.compile(schema);
	} catch (error) {
		throw new NodeOperationError(
			node,
			`The JSON Schema could not be compiled: ${(error as Error).message}`,
			{ itemIndex },
		);
	}

	if ('$async' in validate && validate.$async) {
		throw new NodeOperationError(node, 'Async JSON Schemas ($async) are not supported', {
			itemIndex,
		});
	}

	return validate;
}

export class DataValidator implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Data Validator',
		name: 'dataValidator',
		icon: 'file:analysis.svg',
		group: ['transform'],
		version: 1,
		subtitle:
			'={{$parameter["propertyPath"] ? "Validate: " + $parameter["propertyPath"] : "Validate item"}}',
		description: 'Validate input data before continuing the workflow',
		defaults: {
			name: 'Data Validator',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		properties: [
			{
				displayName: 'JSON Schema',
				name: 'jsonSchema',
				type: 'json',
				typeOptions: {
					alwaysOpenEditWindow: true,
				},
				default: JSON.stringify(DEFAULT_SCHEMA, undefined, 2),
				description:
					'JSON Schema each item is validated against. Visit https://ajv.js.org/ or https://JSON-schema.org/ to learn how to describe your validation rules.',
			},
			{
				displayName: 'Property to Validate',
				name: 'propertyPath',
				type: 'string',
				default: '',
				placeholder: 'e.g. body',
				description:
					'Dot-notation path of the item property to validate, e.g. "body" for webhook payloads. Leave empty to validate the entire item JSON.',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const ajv = new Ajv({ allErrors: true });
		addFormats(ajv);
		ajvErrors(ajv);

		// Parameters may hold expressions that resolve differently per item, so both
		// are read per item; caching keeps the common static schema compiled once.
		const validators = new Map<string, ValidateFunction>();

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			const item = items[itemIndex];

			try {
				const rawSchema = this.getNodeParameter('jsonSchema', itemIndex);
				const schemaKey = typeof rawSchema === 'string' ? rawSchema : JSON.stringify(rawSchema);

				let validate = validators.get(schemaKey);
				if (validate === undefined) {
					validate = compileSchema(this.getNode(), ajv, rawSchema, itemIndex);
					validators.set(schemaKey, validate);
				}

				const propertyPath = this.getNodeParameter('propertyPath', itemIndex, '') as string;
				const dataToValidate =
					propertyPath === '' ? item.json : getByPath(item.json, propertyPath);

				if (propertyPath !== '' && dataToValidate === undefined) {
					returnData.push({
						json: {
							success: false,
							validationErrors: [
								{
									keyword: 'propertyPath',
									message: `Property "${propertyPath}" not found on item`,
									params: { propertyPath },
								},
							],
							data: null,
						},
						binary: item.binary,
						pairedItem: { item: itemIndex },
					});
					continue;
				}

				const valid = validate(dataToValidate);
				const json: IDataObject = {
					success: valid,
					data: (dataToValidate ?? null) as GenericValue,
				};

				if (!valid) {
					json.validationErrors = validate.errors as unknown as IDataObject[];
				}

				returnData.push({
					json,
					binary: item.binary,
					pairedItem: { item: itemIndex },
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						binary: item.binary,
						pairedItem: { item: itemIndex },
					});
					continue;
				}

				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
			}
		}

		return [returnData];
	}
}
