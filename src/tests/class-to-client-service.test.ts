
import { expect } from "chai";
import * as fs from "fs";
import { ExpressRESTGenerator } from "../express-rest-generator";

describe("Client class generation tests", () => {
    const outFile = "./generated/RestClassService.ts";
    it("should generate client rest code", () => {
        ExpressRESTGenerator.generateClientServiceFromFile(__dirname + "/empty-classes.ts", outFile, "angular", {
            className : "RestClassWithExposedMethods",
            embedInterfaces : true,
        });
        ExpressRESTGenerator.generateClientServiceFromFile(__dirname + "/test-class.ts", "./generated/rest.ts", "angular");
        const exists = fs.existsSync(outFile);
        expect(exists).to.be.true;
    });

    after(() => {
        if (fs.existsSync(outFile)) {
            fs.unlinkSync(outFile);
        }
    });
});
