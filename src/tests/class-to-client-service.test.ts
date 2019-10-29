
import { expect } from "chai";
import { Router } from "express";
import * as fs from "fs";
import { ClientRestGenerator } from "../client-rest-generator";
import { ExpressRESTGenerator } from "../express-rest-generator";
import { RestClass, RestClassWithExposedMethods, RestClassWithoutExposedMethods } from "./empty-classes";

describe("ClientRestServiceGenerator", () => {
    const outFile = "./generated/RestClassService.ts";
    it("should generate client rest code", () => {
        ClientRestGenerator.generateClientServiceFromFile(__dirname + "/empty-classes.ts", outFile, "angular", {
            className : "RestClassWithExposedMethods",
            embedInterfaces : true,
        });
        const exists = fs.existsSync(outFile);
        expect(exists).to.be.true;
    });

    after(() => {
        if (fs.existsSync(outFile)) {
            fs.unlinkSync(outFile);
        }
    });
});
