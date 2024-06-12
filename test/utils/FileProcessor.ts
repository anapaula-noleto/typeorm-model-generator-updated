import { EOL } from "os";
import * as Prettier from "prettier";
import { eolConverter } from "../../src/IGenerationOptions";

export class FileProcessor {
  constructor(private renderedFile: string, private generationOptions) {
      this.renderedFile = renderedFile;
      this.generationOptions = generationOptions;
  }

  prettierOptions: Prettier.Options = {
    parser: "typescript",
    endOfLine: "auto",
  };

  public convertEOL(): FileProcessor  {
      if (EOL !== eolConverter[this.generationOptions.convertEol]) {
          this.renderedFile = this.renderedFile.replace(
              /(\r\n|\n|\r)/gm,
              eolConverter[this.generationOptions.convertEol]
          );
      }
      return this;
  }

  public removeUnusedImports(): FileProcessor {
    const importStartIndex = this.renderedFile.indexOf("import");
    const openBracketIndex = this.renderedFile.indexOf("{", importStartIndex) + 1;
    const closeBracketIndex = this.renderedFile.indexOf("}", openBracketIndex);

    if (openBracketIndex === 0 || closeBracketIndex === -1) {
      return this;
    }

    const imports = this.renderedFile
      .substring(openBracketIndex, closeBracketIndex)
      .split(",")
      .map((v) => v.trim()) // Trim any whitespace around imports
      .filter((v) => v); // Remove any empty strings

    const restOfEntityDefinition = this.renderedFile.substring(closeBracketIndex);
    let distinctImports = imports.filter(
      (v) =>
        restOfEntityDefinition.indexOf(`@${v}(`) !== -1 ||
        (v === "BaseEntity" && restOfEntityDefinition.indexOf(v) !== -1)
    );

    // If no distinct imports remain, remove the entire import line
    if (distinctImports.length === 0) {
      const importEndIndex = this.renderedFile.indexOf(";", closeBracketIndex) + 1;
      this.renderedFile = `${this.renderedFile.substring(0, importStartIndex)}${this.renderedFile
        .substring(importEndIndex)
        .trim()}`;
      return this;
    }

    this.renderedFile = `${this.renderedFile.substring(0, openBracketIndex)}${distinctImports.join(
      ","
    )}${this.renderedFile.substring(closeBracketIndex)}`;

    return this;
  }

  public prettierFormat(prettierOptions?: Prettier.Options): FileProcessor {
      if (prettierOptions) {
          this.prettierOptions = prettierOptions;
      }

      this.renderedFile = Prettier.format(this.renderedFile, this.prettierOptions);
      return this;
  }

  public getRenderedFile(): string {
      return this.renderedFile;
  }
}