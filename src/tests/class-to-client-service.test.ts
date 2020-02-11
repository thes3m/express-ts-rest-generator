
import { expect } from "chai";
import * as fs from "fs";
import { ExpressRESTGenerator } from "../express-rest-generator";

describe("Client class generation tests", () => {
    const outFile = "./generated/RestClassService.ts";

    it("should not generate client rest code", () => {
        expect(() => {
            ExpressRESTGenerator.generateClientServiceFromFile(__dirname + "/test.ts", outFile);
        }).to.throw();
    });

    it("should generate client rest code", () => {
        ExpressRESTGenerator.generateClientServiceFromFile(__dirname + "/test-rest-classes.ts", outFile, "angular", {
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
