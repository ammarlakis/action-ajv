let core;
const Ajv = require("ajv");
const addFormats = require("ajv-formats");
const { promises: fs } = require("fs");
const glob = require("glob-promise");
const jsyaml = require("js-yaml");

// Keep unset values out of Ajv options and preserve explicit false values.
function input(name, ...types) {
  const value = core.getInput(name);
  if (value === "") return undefined;
  for (const type of types) {
    if (type === "boolean" && /^(true|false)$/i.test(value)) return value.toLowerCase() === "true";
    if (type === "integer" && /^[+-]?\d+$/.test(value) && Number.isSafeInteger(Number(value))) return Number(value);
    if (type === "json") {
      try { return JSON.parse(value); } catch { /* Try the next supported type. */ }
    }
    if (type === "string") return value;
  }
  throw new Error(`Invalid value for input ${name}`);
}

const OUTPUTS = {
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

async function validate() {
  core = await import("@actions/core");
  try {
    const [data, schema] = await Promise.all([
      loadFiles(core.getInput("data", { required: true })),
      loadFiles(core.getInput("schema", { required: true })),
    ]);

    if (schema.length == 0) {
      core.setFailed("Failed to load the schema");
      core.setOutput(OUTPUTS.valid, false);
      return;
    }

    if (data.length == 0) {
      core.info("Nothing to validate");
      core.setOutput(OUTPUTS.valid, true);
      return;
    }

    const rawOptions = {
      strict: input("strict", "boolean", "string"),
      strictSchema: input("strictSchema", "boolean", "string"),
      strictNumbers: input("strictNumbers", "boolean"),
      strictTypes: input("strictTypes", "boolean", "string"),
      strictTuples: input("strictTuples", "boolean", "string"),
      strictRequired: input("strictRequired", "boolean", "string"),
      allowUnionTypes: input("allowUnionTypes", "boolean"),
      allowMatchingProperties: input("allowMatchingProperties","boolean"),
      validateFormats: input("validateFormats", "boolean"),
      allErrors: input("allErrors", "boolean"),
      verbose: input("verbose", "boolean"),
      discriminator: input("discriminator", "boolean"),
      unicodeRegExp: input("unicodeRegExp", "boolean"),
      timestamp: input("timestamp", "string"),
      parseDate: input("parseDate", "boolean"),
      allowDate: input("allowDate", "boolean"),
      int32range: input("int32range", "boolean"),
      $comment: input("comment", "boolean"),
      removeAdditional: input("removeAdditional","boolean","string"),
      useDefaults: input("useDefaults", "boolean", "string"),
      coerceTypes: input("coerceTypes", "boolean", "string"),
      meta: input("meta", "boolean", "json"),
      validateSchema: input("validateSchema", "boolean", "string"),
      addUsedSchema: input("addUsedSchema", "boolean"),
      inlineRefs: input("inlineRefs", "boolean", "integer"),
      passContext: input("passContext", "boolean"),
      loopRequired: input("loopRequired", "integer"),
      loopEnum: input("loopEnum", "integer"),
      ownProperties: input("ownProperties", "boolean"),
      multipleOfPrecision: input("multipleOfPrecision", "integer"),
      messages: input("messages", "boolean"),
      codeEs5: input("codeEs5", "boolean"),
      codeEsm: input("codeEsm", "boolean"),
      codeLines: input("codeLines", "boolean"),
      codeSource: input("codeSource", "boolean"),
      codeOptimize: input("codeOptimize", "boolean", "integer"),
    };

    const options = {};
    const codeNames = { codeEs5: "es5", codeEsm: "esm", codeLines: "lines", codeSource: "source", codeOptimize: "optimize" };
    for (const [key, value] of Object.entries(rawOptions)) {
      if (value === undefined) continue;
      if (codeNames[key]) {
        options.code ??= {};
        options.code[codeNames[key]] = value;
      } else {
        options[key] = value;
      }
    }
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
      core.setOutput(OUTPUTS.valid, false);
      core.setOutput(OUTPUTS.errors, JSON.stringify(validationArray.flatMap((entry) => entry.errors ?? [])));
    } else {
      core.setOutput(OUTPUTS.valid, true);
      core.info("Validation successful!");
    }
  } catch (error) {
    core.setOutput(OUTPUTS.valid, false);
    core.setFailed(`Failed to validate: ${error.message}`);
  }
}

validate();
