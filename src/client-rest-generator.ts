import * as fs from "fs";
import * as path from "path";
import { Configuration, ILinterOptions, Linter } from "tslint";
import { AngularRestGenerator } from "./generators/angular-rest-generator";
import { FetchRestGenerator } from "./generators/fetch-rest-generator";
import { IRestGenerator } from "./generators/rest-generator";

export class ClientRestGenerator {
    public static generateClientServiceFromFile(tsClassFilePath: string, className: string, outputFile: string, embedInterfaces: boolean = true, generatorType: "fetch" | "angular" = "fetch") {
        let generator: IRestGenerator;
        if (generatorType === "fetch") {
            generator = new FetchRestGenerator();
        } else if (generatorType === "angular") {
            generator = new AngularRestGenerator();
        }

        if (!generator) {
            throw new Error("cannot find generator for type:" + generatorType);
        }

        this.generateClientService(tsClassFilePath, className, outputFile, embedInterfaces, generator);
    }

    public static generateClientService(tsClassFilePath: string, className: string, outputFile: string, embedInterfaces: boolean = true, generator: IRestGenerator) {
        const generatorOutput = generator.generateClientServiceFromFile(tsClassFilePath, className, outputFile, embedInterfaces);

        const outputDir = path.dirname(outputFile);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, {recursive : true});
        }

        fs.writeFileSync(outputFile,  generatorOutput);

        this.lintCode(outputFile);
    }

    private static lintCode(fileName: string): string {
        const options: ILinterOptions = {
            fix: true,
            formatter: "json",
            formattersDirectory: "customFormatters/",
            rulesDirectory: "customRules/",
        };

        const fileContents = fs.readFileSync(fileName, "utf8");
        const linter = new Linter(options);
        const configuration = Configuration.findConfiguration(undefined, fileName).results;
        linter.lint(fileName, fileContents, configuration);
        const result = linter.getResult();
        return result.output;
    }
}
