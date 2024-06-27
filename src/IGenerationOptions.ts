import { EOL } from "os";

import path = require("path");

// TODO: change name

// eslint-disable-next-line @typescript-eslint/interface-name-prefix
export default interface IGenerationOptions {
    schemasPath: string;
    modelsPath: string;
    entitiesPath: string;
    pluralizeNames: boolean;
    noConfigs: boolean;
    convertCaseFile: "pascal" | "param" | "camel" | "none";
    convertCaseEntity: "pascal" | "camel" | "none";
    convertCaseProperty: "pascal" | "camel" | "snake" | "none";
    convertEol: "LF" | "CRLF";
    propertyVisibility: "public" | "protected" | "private" | "none";
    lazy: boolean;
    activeRecord: boolean;
    generateConstructor: boolean;
    customNamingStrategyPath: string;
    relationIds: boolean;
    strictMode: "none" | "?" | "!";
    skipSchema: boolean;
    indexFile: boolean;
    exportType: "named" | "default";
    generateMissingTables: boolean;
    all: boolean;
    genModels: boolean;
    genEntities: boolean;
    genSchemas: boolean;
    genRepositories: boolean;
}

export const eolConverter = {
    LF: "\n",
    CRLF: "\r\n",
};

export function getDefaultGenerationOptions(): IGenerationOptions {
    const generationOptions: IGenerationOptions = {
        schemasPath: path.resolve(process.cwd(), "schemas"),
        modelsPath: path.relative(process.cwd(), "models"),
        entitiesPath: path.relative(process.cwd(), "entities"),
        pluralizeNames: true,
        noConfigs: false,
        convertCaseFile: "camel",
        convertCaseEntity: "pascal",
        convertCaseProperty: "camel",
        convertEol: EOL === "\n" ? "LF" : "CRLF",
        propertyVisibility: "none",
        lazy: false,
        activeRecord: false,
        generateConstructor: false,
        customNamingStrategyPath: "",
        relationIds: false,
        strictMode: "none",
        skipSchema: false,
        indexFile: false,
        exportType: "named",
        generateMissingTables: false,
        all: false,
        genModels: false,
        genEntities: false,
        genSchemas: false,
        genRepositories: false,
    };
    return generationOptions;
}
