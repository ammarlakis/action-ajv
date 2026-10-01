const core = require("@actions/core");
const Ajv = require("ajv");
const addFormats = require("ajv-formats");
const { promises: fs } = require("fs");
const glob = require("glob-promise");
const utils = require("@gh-actions-utils/inputs");
const jsyaml = require("js-yaml");

const OUPTUTS = {
  valid: "valid",
  errors: "errors",
};

async function loadFiles(pathOrData) {
  try {
    const files = await glob(pathOrData);
    const data = await Promise.all(
      files.map(async (file) => {
        const contents = await fs.readFile(file, "utf8");
        return { filename: file, contents: jsyaml.load(contents) };
      })
    );
    return data;
  } catch (error) {
    core.setFailed(`Error loading data: ${error.message}`);
    throw error;
  }
}

// Empty action inputs must not override Ajv's defaults.
function option(inputName, ...types) {
  if (core.getInput(inputName) === "") return undefined;
  return utils.parseInput(inputName, ...types)?.value;
}

async function validate() {
  try {
    const [data, schema] = await Promise.all([
      loadFiles(utils.parseInput("data", "String").value),
      loadFiles(utils.parseInput("schema", "String").value),
    ]);

    if (schema.length == 0) {
      core.setFailed("Failed to load the schema");
      core.setOutput(OUPTUTS.valid, false);
      return;
    }

    if (data.length == 0) {
      core.info("Nothing to validate");
      core.setOutput(OUPTUTS.valid, true);
      return;
    }

    const options = {
      strict: option("strict", "boolean", "string"),
      strictSchema: option("strictSchema", "boolean", "string"),
      strictNumbers: option("strictNumbers", "boolean"),
      strictTypes: option("strictTypes", "boolean", "string"),
      strictTuples: option("strictTuples", "boolean", "string"),
      strictRequired: option("strictRequired", "boolean", "string"),
      allowUnionTypes: option("allowUnionTypes", "boolean"),
      allowMatchingProperties: option("allowMatchingProperties","boolean"),
      validateFormats: option("validateFormats", "boolean"),
      allErrors: option("allErrors", "boolean"),
      verbose: option("verbose", "boolean"),
      discriminator: option("discriminator", "boolean"),
      unicodeRegExp: option("unicodeRegExp", "boolean"),
      timestamp: option("timestamp", "string"),
      parseDate: option("parseDate", "boolean"),
      allowDate: option("allowDate", "boolean"),
      int32range: option("int32range", "boolean"),
      $comment: option("comment", "boolean"),
      removeAdditional: option("removeAdditional","boolean","string"),
      useDefaults: option("useDefaults", "boolean", "string"),
      coerceTypes: option("coerceTypes", "boolean", "string"),
      meta: option("meta", "boolean", "json"),
      validateSchema: option("validateSchema", "boolean", "string"),
      addUsedSchema: option("addUsedSchema", "boolean"),
      inlineRefs: option("inlineRefs", "boolean", "integer"),
      passContext: option("passContext", "boolean"),
      loopRequired: option("loopRequired", "integer"),
      loopEnum: option("loopEnum", "integer"),
      ownProperties: option("ownProperties", "boolean"),
      multipleOfPrecision: option("multipleOfPrecision", "integer"),
      messages: option("messages", "boolean"),
      codeEs5: option("codeEs5", "boolean"),
      codeEsm: option("codeEsm", "boolean"),
      codeLines: option("codeLines", "boolean"),
      codeSource: option("codeSource", "boolean"),
      codeOptimize: option("codeOptimize", "boolean", "integer"),
    };

    const ajv = new Ajv(options);
    addFormats(ajv);
    const validate = ajv.compile(schema[0].contents);
    const validationArray = data.map((file) => {
      validate(file.contents);
      return {
        filename: file.filename,
        errors: validate.errors,
      };
    });

    if (!validationArray.every((validation) => validation.errors == null)) {
      core.setFailed(
        `Validation errors: ${JSON.stringify(
          validationArray.filter((validation) => validation.errors != null)
        )}`
      );
      core.setOutput(OUPTUTS.valid, false);
      core.setOutput(OUPTUTS.errors, JSON.stringify(validate.errors));
    } else {
      core.setOutput(OUPTUTS.valid, true);
      core.info("Validation successful!");
    }
  } catch (error) {
    core.setFailed(`Failed to validate: ${error.message}`);
  }
}

validate();
