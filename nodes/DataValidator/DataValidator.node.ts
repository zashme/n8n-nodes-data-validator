import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
	NodeOperationError,
} from "n8n-workflow";
import Ajv, {Schema} from "ajv";

export class DataValidator implements INodeType {
	description: INodeTypeDescription = {
		displayName: "Data Validator",
		name: "dataValidator",
		icon: 'file:analysis.svg',
		group: ["transform"],
		version: 1,
		description: "Validate input data before continuing the workflow",
		defaults: {
			name: "Data Validator",
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		properties: [
			{
				displayName: "JSON Schema",
				name: "jsonSchema",
				type: "json",
				typeOptions: {
					alwaysOpenEditWindow: true,
				},
				default: JSON.stringify(
					{
						type: "object",
						properties: {
							foo: {type: "integer"},
							bar: {type: "string"},
						},
						required: ["foo"],
						additionalProperties: false,
					},
					undefined,
					2
				),
				placeholder: "",
				description: 'Visit https://ajv.js.org/ or https://JSON-schema.org/ to learn how to describe your validation rules in JSON Schemas',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		let item: INodeExecutionData;

		const jsonSchemaString = this.getNodeParameter("jsonSchema", 0);

		if (typeof jsonSchemaString !== "string") {
			throw new NodeOperationError(this.getNode(), "Invalid JSON Schema");
		}

		let jsonSchema: Schema;

		try {
			jsonSchema = JSON.parse(jsonSchemaString) as Schema;
		} catch (err) {
			throw new NodeOperationError(this.getNode(), "Invalid JSON Schema");
		}

		const ajv = new Ajv({allErrors: true});
		let validate: ReturnType<typeof ajv["compile"]>;

		try {
			validate = ajv.compile(jsonSchema);
		} catch (err) {
			throw new NodeOperationError(this.getNode(), "Invalid JSON Schema");
		}

		item = items[0]!;

		const newItemBinary = item.binary;
		const newItemJson = item.json.body;

		const valid = validate(item.json.body);

		if (!valid) {
			if (validate.errors) {
				// Return validation errors in the response instead of throwing
				return this.prepareOutputData(
					[{
						json: {
							success: false,
							validationErrors: validate.errors,
							data: newItemJson,
						},
						binary: newItemBinary,
					}]);
			}
		}

		return this.prepareOutputData([{
			json: {
				success: true,
				data: newItemJson
			},
			binary: newItemBinary,
		}]);
	}
}
