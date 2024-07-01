import * as Handlebars from "handlebars";
import * as Prettier from "prettier";
import * as changeCase from "change-case";
import * as fs from "fs";
import * as path from "path";
import IConnectionOptions from "./IConnectionOptions";
import IGenerationOptions from "./IGenerationOptions";
import { Entity } from "./models/Entity";
import { Relation } from "./models/Relation";
import pluralize = require("pluralize");
import { FileProcessor } from "./utils/FileProcessor";

export default function GenerationPhase(
    connectionOptions: IConnectionOptions,
    generationOptions: IGenerationOptions,
    databaseModel: Entity[]
): void {
    createHandlebarsHelpers(generationOptions);

    const schemaPath = generationOptions.schemasPath;
    const modelPath = generationOptions.modelsPath;
    const entityPath = generationOptions.entitiesPath;

    if (!generationOptions.noConfigs) {
        const tsconfigPath = path.resolve("tsconfig.json");
        const typeormConfigPath = path.resolve("ormconfig.json");

        createTsConfigFile(tsconfigPath);
        createTypeOrmConfig(typeormConfigPath, connectionOptions);
    }
    // if (generationOptions.indexFile) {
    //     createIndexFile(databaseModel, generationOptions, entitySchemasPath);
    // }

    generateSelectedFiles(
        databaseModel,
        generationOptions,
        entityPath,
        modelPath,
        schemaPath
    );
}

function generateFileFromDatabase(
    databaseModel: Entity[],
    generationOptions: IGenerationOptions,
    filePath: string,
    templateName: string,
    fileNameEndsWith?: string,
    fileNameBeginsWith?: string
) {
    const templatePath = path.resolve(__dirname, "templates", templateName);
    const template = fs.readFileSync(templatePath, "utf-8");
    const compiledTemplate = Handlebars.compile(template, {
        noEscape: true,
    });

    databaseModel.forEach((element) => {
        let fileName = setFileNamePlurality(
            generationOptions,
            element.fileName
        );

        fileName = fileNameEndsWith
            ? `${fileName}-${fileNameEndsWith}`
            : fileName;

        fileName = fileNameBeginsWith
            ? `${fileNameBeginsWith}-${fileName}`
            : fileName;

        const casedFileName = setFileNameWithCase(generationOptions, fileName);

        const relativeFilePath = path.resolve(filePath);
        if (!fs.existsSync(relativeFilePath)) {
            fs.mkdirSync(relativeFilePath);
        }

        const resultFilePath = path.resolve(
            relativeFilePath,
            `${casedFileName}.ts`
        );

        if (
            generationOptions.generateMissingTables &&
            fileAlreadyCreated(resultFilePath)
        ) {
            return;
        }

        const renderedText = compiledTemplate(element);

        const finalFileText = new FileProcessor(renderedText, generationOptions)
            .removeUnusedImports()
            .convertEOL()
            .prettierFormat()
            .getRenderedFile();

        fs.writeFileSync(resultFilePath, finalFileText, {
            encoding: "utf-8",
            flag: "w",
        });
    });
}

function generateFile(
    generationOptions: IGenerationOptions,
    filePath: string,
    templateName: string,
    fileName: string
) {
    const templatePath = path.resolve(__dirname, "templates", templateName);
    const template = fs.readFileSync(templatePath, "utf-8");
    const compiledTemplate = Handlebars.compile(template, {
        noEscape: true,
    });

    const casedFileName = setFileNameWithCase(generationOptions, fileName);

    const relativeFilePath = path.resolve(filePath);
    if (!fs.existsSync(relativeFilePath)) {
        fs.mkdirSync(relativeFilePath);
    }

    const resultFilePath = path.resolve(
        relativeFilePath,
        `${casedFileName}.ts`
    );

    if (
        generationOptions.generateMissingTables &&
        fileAlreadyCreated(resultFilePath)
    ) {
        return;
    }

    const renderedText = compiledTemplate({});

    const finalFileText = new FileProcessor(renderedText, generationOptions)
        .convertEOL()
        .prettierFormat()
        .getRenderedFile();

    fs.writeFileSync(resultFilePath, finalFileText, {
        encoding: "utf-8",
        flag: "w",
    });
}

function setFileNameWithCase(
    generationOptions: IGenerationOptions,
    fileName: string
): string {
    let casedFileName = "";
    switch (generationOptions.convertCaseFile) {
        case "camel":
            casedFileName = changeCase.camelCase(fileName);
            break;
        case "param":
            casedFileName = changeCase.paramCase(fileName);
            break;
        case "pascal":
            casedFileName = changeCase.pascalCase(fileName);
            break;
        case "none":
            casedFileName = fileName;
            break;
        default:
            throw new Error("Unknown case style");
    }
    return casedFileName;
}

function setFileNamePlurality(
    generationOptions: IGenerationOptions,
    fileName: string
): string {
    let casedFileName = "";
    if (generationOptions.pluralizeNames) {
        casedFileName = pluralize.plural(fileName);
    } else {
        casedFileName = pluralize.singular(fileName);
    }
    return casedFileName;
}

function generateSelectedFiles(
    databaseModel: Entity[],
    generationOptions: IGenerationOptions,
    entitiesPath: string,
    modelsPath: string,
    entitySchemasPath: string
) {
    if (generationOptions.all) {
        generateFileFromDatabase(
            databaseModel,
            generationOptions,
            entitySchemasPath,
            "entity-schema.mst",
            "schema"
        );
        generateFileFromDatabase(
            databaseModel,
            generationOptions,
            modelsPath,
            "model.mst"
        );
        generateFileFromDatabase(
            databaseModel,
            generationOptions,
            entitiesPath,
            "entity.mst"
        );
        generateRepositoryFiles(
            databaseModel,
            generationOptions,
            generationOptions.repositoriesPortsPath,
            generationOptions.repositoriesAdaptersPath,
            generationOptions.dtosPath
        );
    } else {
        if (generationOptions.genEntities) {
            generateFileFromDatabase(
                databaseModel,
                generationOptions,
                entitiesPath,
                "entity.mst"
            );
        }
        if (generationOptions.genModels) {
            generateFileFromDatabase(
                databaseModel,
                generationOptions,
                modelsPath,
                "model.mst"
            );
        }
        if (generationOptions.genSchemas) {
            generateFileFromDatabase(
                databaseModel,
                generationOptions,
                entitySchemasPath,
                "entity-schema.mst",
                "schema"
            );
        }
        if (generationOptions.genRepositories) {
            generateRepositoryFiles(
                databaseModel,
                generationOptions,
                generationOptions.repositoriesPortsPath,
                generationOptions.repositoriesAdaptersPath,
                generationOptions.dtosPath
            );
        }
        if (
            !generationOptions.genEntities &&
            !generationOptions.genModels &&
            !generationOptions.genSchemas &&
            !generationOptions.genRepositories
        ) {
            console.error(
                "Nothing set to generate. Please use --all, --genEntities, --genModels, --genRepositories or --genSchemas"
            );
        }
    }
}

function fileAlreadyCreated(filePath: string) {
    return fs.existsSync(filePath);
}

function createIndexFile(
    databaseModel: Entity[],
    generationOptions: IGenerationOptions,
    entitiesPath: string
) {
    const templatePath = path.resolve(__dirname, "templates", "index.mst");
    const template = fs.readFileSync(templatePath, "utf-8");
    const compliedTemplate = Handlebars.compile(template, {
        noEscape: true,
    });
    const rendered = compliedTemplate({ entities: databaseModel });
    const formatted = new FileProcessor(rendered, generationOptions)
        .prettierFormat()
        .getRenderedFile();
    let fileName = "index";
    switch (generationOptions.convertCaseFile) {
        case "camel":
            fileName = changeCase.camelCase(fileName);
            break;
        case "param":
            fileName = changeCase.paramCase(fileName);
            break;
        case "pascal":
            fileName = changeCase.pascalCase(fileName);
            break;
        default:
    }
    const resultFilePath = path.resolve(entitiesPath, `${fileName}.ts`);
    fs.writeFileSync(resultFilePath, formatted, {
        encoding: "utf-8",
        flag: "w",
    });
}

function createHandlebarsHelpers(generationOptions: IGenerationOptions): void {
    Handlebars.registerHelper("json", (context) => {
        const json = JSON.stringify(context);
        const withoutQuotes = json.replace(/"([^(")"]+)":/g, "$1:");
        return withoutQuotes.slice(1, withoutQuotes.length - 1);
    });
    Handlebars.registerHelper("jsonStringify", function (context) {
        return JSON.stringify(context);
    });
    Handlebars.registerHelper("toparamCase", (str) => {
        return changeCase.paramCase(str);
    });
    Handlebars.registerHelper("singularize", (str) => {
        return pluralize.singular(str);
    });
    Handlebars.registerHelper("toLowerCase", (str) => {
        return str.toLowerCase();
    });
    Handlebars.registerHelper("getFilePath", (str) => {
        if (str === "entity") {
            return generationOptions.entitiesPath;
        }
        if (str === "models") {
            return generationOptions.modelsPath;
        }
        if (str === "schema") {
            return generationOptions.schemasPath;
        }
        if (str === "repository-adapter") {
            return generationOptions.repositoriesAdaptersPath;
        }
        if (str === "dtos") {
            return generationOptions.dtosPath;
        }
        if (str === "repository-port") {
            return generationOptions.repositoriesPortsPath;
        }
        return "";
    });
    Handlebars.registerHelper("getRelativePath", (fromFilePath, toFilePath) => {
        if (fromFilePath == toFilePath) {
            return `./`;
        }
        return `${path.relative(fromFilePath, toFilePath)}/`;
    });
    Handlebars.registerHelper("toEntityName", (str) => {
        str = pluralize.singular(str);
        let retStr = "";
        switch (generationOptions.convertCaseEntity) {
            case "camel":
                retStr = changeCase.camelCase(str);
                break;
            case "pascal":
                retStr = changeCase.pascalCase(str);
                break;
            case "none":
                retStr = str;
                break;
            default:
                throw new Error("Unknown case style");
        }
        return retStr;
    });
    Handlebars.registerHelper("toFileName", (str) => {
        return changeCase.camelCase(str);
    });
    Handlebars.registerHelper("printPropertyVisibility", () =>
        generationOptions.propertyVisibility !== "none"
            ? `${generationOptions.propertyVisibility} `
            : ""
    );

    Handlebars.registerHelper(
        "firstLetterToUppercase",
        (str) => str.charAt(0).toUpperCase() + str.slice(1)
    );

    Handlebars.registerHelper("toPropertyName", (str) => {
        let retStr = "";
        switch (generationOptions.convertCaseProperty) {
            case "camel":
                retStr = changeCase.camelCase(str);
                break;
            case "pascal":
                retStr = changeCase.pascalCase(str);
                break;
            case "none":
                retStr = str;
                break;
            case "snake":
                retStr = changeCase.snakeCase(str);
                break;
            default:
                throw new Error("Unknown case style");
        }
        return retStr;
    });
    Handlebars.registerHelper(
        "toRelation",
        (entityType: string, relationType: Relation["relationType"]) => {
            let retVal = entityType;
            if (relationType === "ManyToMany" || relationType === "OneToMany") {
                retVal = `${retVal}[]`;
            }
            if (generationOptions.lazy) {
                retVal = `Promise<${retVal}>`;
            }
            return retVal;
        }
    );
    Handlebars.registerHelper("defaultExport", () =>
        generationOptions.exportType === "default" ? "default" : ""
    );
    Handlebars.registerHelper(
        "localImport",
        (entityName: string) => `{${entityName}}`
    );
    Handlebars.registerHelper("strictMode", () =>
        generationOptions.strictMode !== "none"
            ? generationOptions.strictMode
            : ""
    );
    Handlebars.registerHelper({
        and: (v1, v2) => v1 && v2,
        eq: (v1, v2) => v1 === v2,
        gt: (v1, v2) => v1 > v2,
        gte: (v1, v2) => v1 >= v2,
        lt: (v1, v2) => v1 < v2,
        lte: (v1, v2) => v1 <= v2,
        ne: (v1, v2) => v1 !== v2,
        or: (v1, v2) => v1 || v2,
    });
    Handlebars.registerHelper("isRelationArray", (relationType) => {
        return relationType === "ManyToMany" || relationType === "OneToMany";
    });
    Handlebars.registerHelper("isManyToOne", (relationType) => {
        return relationType === "ManyToOne";
    });
}

function createTsConfigFile(tsconfigPath: string): void {
    if (fs.existsSync(tsconfigPath)) {
        console.warn(
            `\x1b[33m[${new Date().toLocaleTimeString()}] WARNING: Skipping generation of tsconfig.json file. File already exists. \x1b[0m`
        );
        return;
    }
    const templatePath = path.resolve(__dirname, "templates", "tsconfig.mst");
    const template = fs.readFileSync(templatePath, "utf-8");
    const compliedTemplate = Handlebars.compile(template, {
        noEscape: true,
    });
    const rendered = compliedTemplate({});
    const formatted = Prettier.format(rendered, { parser: "json" });
    fs.writeFileSync(tsconfigPath, formatted, {
        encoding: "utf-8",
        flag: "w",
    });
}

function createTypeOrmConfig(
    typeormConfigPath: string,
    connectionOptions: IConnectionOptions
): void {
    if (fs.existsSync(typeormConfigPath)) {
        console.warn(
            `\x1b[33m[${new Date().toLocaleTimeString()}] WARNING: Skipping generation of ormconfig.json file. File already exists. \x1b[0m`
        );
        return;
    }
    const templatePath = path.resolve(__dirname, "templates", "ormconfig.mst");
    const template = fs.readFileSync(templatePath, "utf-8");
    const compiledTemplate = Handlebars.compile(template, {
        noEscape: true,
    });
    const rendered = compiledTemplate(connectionOptions);
    const formatted = Prettier.format(rendered, { parser: "json" });
    fs.writeFileSync(typeormConfigPath, formatted, {
        encoding: "utf-8",
        flag: "w",
    });
}

function generateRepositoryFiles(
    databaseModel: Entity[],
    generationOptions: IGenerationOptions,
    repoPortPath: string,
    repoAdapterPath: string,
    repoDtoPath: string
) {
    console.log("Generating repository files");
    console.log(generationOptions.pluralizeNames, "pluralizeNames");
    generateFile(
        generationOptions,
        repoPortPath,
        "base-repository-typeorm-port.mst",
        "repository"
    );
    generateFile(
        generationOptions,
        repoDtoPath,
        "base-repository-types.mst",
        "generic"
    );
    generateFileFromDatabase(
        databaseModel,
        generationOptions,
        repoPortPath,
        "repository-port.mst",
        "repository"
    );
    generateFile(
        generationOptions,
        repoAdapterPath,
        "base-repository-typeorm-adapter.mst",
        "typeORMRepository"
    );
    generateFileFromDatabase(
        databaseModel,
        generationOptions,
        repoAdapterPath,
        "repository-adapter.mst",
        "repository",
        "typeORM"
    );
}
