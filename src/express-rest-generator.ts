import { NextFunction, Request, Response, Router } from "express";
import * as fs from "fs";
import * as path from "path";
import "reflect-metadata";
import { Configuration, ILinterOptions, Linter } from "tslint";
import { AngularRestGenerator } from "./generators/angular-rest-generator";
import { IClientGeneratorSettings } from "./generators/client-generator-settings";
import { FetchRestGenerator } from "./generators/fetch-rest-generator";
import { IRestGenerator } from "./generators/rest-generator";
import { Utils } from "./utils";

export class ExpressRESTGenerator {

    /**
     * Converts class instance to Rest router and exposes all methods that have @RestMethod decorators.
     * @param routerClass class instance which we want to transform to router
     */
    public static convertClassToExpressRouter(routerClass: any): Router {
        if (!routerClass) {
            throw new Error("Invalid router class:" + routerClass);
        }

        const apiPrefix = Reflect.getMetadata("apiPrefix", routerClass);

        if (apiPrefix === undefined) {
            throw new Error("Class " + (routerClass && routerClass.constructor ? routerClass.constructor.name : "") + " does not have a @RestApi decorator.") ;
        }

        // Create a router to which we will attach methods
        const router = Router();

        for (const methodName in routerClass) {
            const method = routerClass[methodName] as any;

            // Check if member is a function and if it had @RestMethod decorator
            if (typeof(method) === "function" && Reflect.getMetadata("restmethod", routerClass, methodName) !== undefined) {
                // Try to determine request method type form method name

                // Get all method types in a string[]
                const fnArgTypes = Reflect.getMetadata("design:paramtypes", routerClass, methodName).map((x: any) => this.getStringTypeFromReflectionType(x));
                const fnArgs = Utils.getFunctionArgs(method);
                const methodType = Utils.getRequestMethodType(methodName, fnArgTypes);

                if (fnArgTypes.length !== fnArgs.length) {
                    throw new Error("Length of method types and argument names does not match!");
                }

                // Create a router method
                (router as any)[methodType](apiPrefix + Utils.getEndpointPath(methodName), async (req: Request, res: Response, next: NextFunction) => {
                    try {
                        // Get query parameters from method parameters and pass them on
                        const args: any[] = [];
                        for (let i = 0; i < fnArgs.length; i++) {
                            const paramName = fnArgs[i];

                            const fnParamType = fnArgTypes[i];
                            let reqParamValue = req.query[paramName];
                            const reqParamType = typeof(reqParamValue);
                            // Check if we need to convert parameter to a different type since query params are always strings
                            if (paramName === "body") {
                                reqParamValue = req.body;
                            } else if (fnParamType !== reqParamType) {
                                if (fnParamType === "boolean") {
                                    reqParamValue = reqParamValue === "true";
                                } else if (fnParamType === "number") {
                                    reqParamValue = parseFloat(reqParamValue);
                                    if(isNaN(reqParamValue)){
                                        reqParamValue = undefined;
                                    }
                                } else if (fnParamType === "string") {
                                    reqParamValue = reqParamValue;
                                } else if (fnParamType === "object") {
                                    // Get item from body since we store objects in body
                                    if (req.body[paramName]) {
                                        reqParamValue = req.body[paramName];
                                    }
                                }
                            }
                            args.push(reqParamValue);
                        }

                        // Call the method and get the result
                        const result = await routerClass[methodName].apply(routerClass, args);

                        // Send result to client
                        res.send({result});
                    } catch (e) {
                        res.status(500).send({
                            error : e.toString(),
                        });
                    }

                });
            }
        }
        return router;
    }

    public static generateClientServiceFromFile(tsClassFilePath: string, outputFile: string, generatorType: "fetch" | "angular" = "fetch", settings?: IClientGeneratorSettings) {
        let generator: IRestGenerator;
        if (generatorType === "fetch") {
            generator = new FetchRestGenerator();
        } else if (generatorType === "angular") {
            generator = new AngularRestGenerator();
        }

        if (!generator) {
            throw new Error("cannot find generator for type:" + generatorType);
        }

        this.generateClientService(tsClassFilePath, outputFile, generator, settings);
    }
    public static generateClientService(tsClassFilePath: string, outputFile: string, generator: IRestGenerator, settings?: IClientGeneratorSettings) {
        const generatorOutput = generator.generateClientServiceFromFile(tsClassFilePath, outputFile, settings);

        const outputDir = path.dirname(outputFile);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, {recursive : true});
        }

        fs.writeFileSync(outputFile,  generatorOutput);

        // this.lintCode(outputFile);
    }


    // Argument in this case is usually function
    private static getStringTypeFromReflectionType(type: any): string {
        return type.name.replace("String", "string").replace("Number", "number").replace("Boolean", "boolean").replace("Object", "object").replace("Array", "any[]");
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
