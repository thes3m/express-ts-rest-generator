import { IClientGeneratorSettings } from "./client-generator-settings";
import { FetchRestGenerator } from "./fetch-rest-generator";

export class AngularRestGenerator extends FetchRestGenerator {
    public generateClientServiceFromFile(tsClassFilePath: string, outputFile: string, settings?: IClientGeneratorSettings): string  {
        let injectable = "\nimport { Injectable } from '@angular/core'\n\n";
        injectable += "@Injectable({providedIn: 'root'})\n";
        injectable += "export class";

        const result = super.generateClientServiceFromFile(tsClassFilePath, outputFile, settings);
        return result.replace("export class", injectable);
    }
}
