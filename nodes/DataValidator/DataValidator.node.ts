import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
	NodeOperationError,
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

export class DataValidator implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Data Validator',
		name: 'dataValidator',
		icon: 'file:analysis.svg',
		group: ['transform'],
		version: 1,
		description: 'Validate input data before continuing the workflow',
		defaults: {
			name: 'Data Validator',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
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

		const jsonSchemaString = this.getNodeParameter('jsonSchema', 0);

		if (typeof jsonSchemaString !== 'string') {
			throw new NodeOperationError(this.getNode(), 'The JSON Schema must be a string');
		}

		let jsonSchema: Schema;

		try {
			jsonSchema = JSON.parse(jsonSchemaString) as Schema;
		} catch (error) {
			throw new NodeOperationError(
				this.getNode(),
				`The JSON Schema is not valid JSON: ${(error as Error).message}`,
			);
		}

		const ajv = new Ajv({ allErrors: true, strict: false });
		addFormats(ajv);
		ajvErrors(ajv);

		let validate: ValidateFunction;

		try {
			validate = ajv.compile(jsonSchema);
		} catch (error) {
			throw new NodeOperationError(
				this.getNode(),
				`The JSON Schema could not be compiled: ${(error as Error).message}`,
			);
		}

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			const item = items[itemIndex];

			try {
				const propertyPath = this.getNodeParameter('propertyPath', itemIndex, '') as string;
				const dataToValidate =
					propertyPath === '' ? item.json : getByPath(item.json, propertyPath);

				const valid = validate(dataToValidate);
				const json: IDataObject = {
					success: valid,
					data: dataToValidate as IDataObject,
				};

				if (!valid) {
					json.validationErrors = (validate.errors ?? []) as unknown as IDataObject[];
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
						pairedItem: { item: itemIndex },
					});
					continue;
				}

				throw error;
			}
		}

		return [returnData];
	}
}
