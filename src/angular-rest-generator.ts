import { ClientRestGenerator } from './client-rest-generator';

export class AngularRestGenerator extends ClientRestGenerator{
    public static generateClientServiceFromFile(tsClassFilePath: string, className: string, outputFile: string, embedInterfaces: boolean = true) {
        let clientServiceClass = `
            import { Injectable } from '@angular/core';
            @Injectable({providedIn: 'root'});
            export class
        `;
        //TODO add angular injectable 
        return super.generateClientServiceFromFile(tsClassFilePath,className,outputFile,embedInterfaces);
    }
}