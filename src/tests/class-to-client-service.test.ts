
import { expect } from 'chai';
import { Router } from "express";
import { ExpressRESTGenerator } from '../express-rest-generator';
import * as fs from "fs";
import { RestClass,RestClassWithExposedMethods, RestClassWithoutExposedMethods } from './empty-classes';
import { ClientRestGenerator } from '../client-rest-generator';

describe('ClientRestServiceGenerator', () => {
    let outFile = "./generated/RestClassService.ts";
    it('should generate client rest code', () => {
        const classInstance = new RestClassWithExposedMethods();
        ClientRestGenerator.generateClientServiceFromFile(__dirname + "/empty-classes.ts", "RestClassWithExposedMethods",outFile, true, "angular");
        let exists = fs.existsSync(outFile);
        expect(exists).to.be.true;
    });

    after(()=>{
        if(fs.existsSync(outFile)){
            fs.unlinkSync(outFile)
        }
    })
});