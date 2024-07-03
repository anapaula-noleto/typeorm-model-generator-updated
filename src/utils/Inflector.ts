import pluralize = require("pluralize");
import * as changeCase from "change-case";

export class Inflector {
    static pluralize(word: string) {
        return pluralize.plural(word);
    }

    static singularize(word: string) {
        return pluralize.singular(word);
    }

    static camelCase(str: string) {
        return changeCase.camelCase(str);
    }

    static snakeCase(str: string) {
        return changeCase.snakeCase(str);
    }

    static kebabCase(str: string) {
        return changeCase.paramCase(str);
    }

    static pascalCase(str: string) {
        return changeCase.pascalCase(str);
    }
}
