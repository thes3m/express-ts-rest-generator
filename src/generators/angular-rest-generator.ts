import { FetchRestGenerator } from './fetch-rest-generator';

export class AngularRestGenerator extends FetchRestGenerator {
    public generateClientServiceFromFile(tsClassFilePath: string, className: string, outputFile: string, embedInterfaces: boolean = true): string {
        let injectable = "\nimport { Injectable } from '@angular/core'\n\n";
        injectable += "@Injectable({providedIn: 'root'})\n";
        injectable += "export class";
        
        let result = super.generateClientServiceFromFile(tsClassFilePath, className, outputFile, embedInterfaces);
        return result.replace("export class", injectable);
    }
}