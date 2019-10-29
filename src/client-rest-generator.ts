import { FetchRestGenerator } from './generators/fetch-rest-generator';
import { AngularRestGenerator } from './generators/angular-rest-generator';
import { IRestGenerator } from './generators/rest-generator';
import * as path from "path";
import * as fs from "fs";

export class ClientRestGenerator {
    public static generateClientServiceFromFile(tsClassFilePath: string, className: string, outputFile: string, embedInterfaces: boolean = true, generatorType : "fetch" | "angular" = "fetch") {
        let generator : IRestGenerator;
        if (generatorType == "fetch") {
            generator = new FetchRestGenerator();
        }else if(generatorType == "angular"){
            generator = new AngularRestGenerator();
        }

        if(!generator){
            throw new Error("cannot find generator for type:" + generatorType);
        }

        this.generateClientService(tsClassFilePath, className, outputFile, embedInterfaces, generator);
    }

    public static generateClientService(tsClassFilePath: string, className: string, outputFile: string, embedInterfaces: boolean = true, generator: IRestGenerator) {
        let generatorOuput = generator.generateClientServiceFromFile(tsClassFilePath, className, outputFile, embedInterfaces);

        let outputDir = path.dirname(outputFile);
        if(!fs.existsSync(outputDir)){
            fs.mkdirSync(outputDir, {recursive : true})
        }

        fs.writeFileSync(outputFile,  generatorOuput);
    }
}