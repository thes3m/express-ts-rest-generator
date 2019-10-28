import "reflect-metadata";
import { Router, Response, Request, NextFunction } from "express";
import * as fs from "fs";
import * as ts from "typescript";
import * as path from "path";
import { IDictionary } from './interfaces/dictionary';

// type GetArgumentTypes<T> = T extends new (...args: infer U) => any ? U : never;
type Parameters<T> = T extends (... args: infer T) => any ? T : never;

export class ExpressRESTGenerator {

    public static convertClassToExpressRouter(routerClass: any): Router {
        const router = Router();
        const apiPrefix = Reflect.getMetadata("apiPrefix", routerClass);

        router.get("/test", (req: Request, res: Response) => {
            res.send("it works");
        });

        for (const methodName in routerClass) {
            const method = routerClass[methodName] as any;

            if (typeof(method) === "function") {
                // Try to determine request method type form method name
                const methodType = this.getRequestMethodType(methodName);

                // Get all method types in a string[]
                const methodParams = Reflect.getMetadata("design:paramtypes", routerClass, methodName).map((x: any) => this.getStringTypeFromReflectionType(x));
                const fnArgs = this.getFunctionArgs(method);

                if (methodParams.length !== fnArgs.length) {
                    throw new Error("Length of method types and argument names does not match!");
                }

                // Create a router method
                (router as any)[methodType](apiPrefix + this.getEndpointPath(methodName), async (req: Request, res: Response, next: NextFunction) => {
                    try {
                        // Get query parameters from method parameters and pass them on
                        const args: any[] = [];
                        for (let i = 0; i < fnArgs.length; i++) {
                            const paramName = fnArgs[i];

                            const fnParamType = methodParams[i];
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
                                } else if (fnParamType === "string") {
                                    reqParamValue = reqParamValue;
                                } else if (fnParamType === "object") {
                                    // Leave as is
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
                            error : e.toString()
                        });
                    }

                });
            }
        }
        return router;
    }

    // public static generateClientServiceAPIFromRouter(routerClass: any, outputFile: string) {
    //     const apiPrefix = Reflect.getMetadata("apiPrefix", routerClass);

    //     let clientServiceClass = "export class " + routerClass.constructor.name + "Service {\n";
    //     const router = Router();

    //     for (const methodName in routerClass) {
    //         const method = routerClass[methodName] as any;

    //         if (typeof(method) === "function") {
    //             // Try to determine request method type form method name
    //             const methodType = this.getRequestMethodType(methodName);

    //             // Get  all method types in a string[]
    //             const methodParams = Reflect.getMetadata("design:paramtypes", routerClass, methodName).map((x: any) => this.getStringTypeFromReflectionType(x));
    //             // TODO fix return type
    //             const returnType = "any"; // Reflect.getMetadata("design:returntype", routerClass, methodName).name;
    //             const fnArgs = this.getFunctionArgs(method);

    //             // Create a request method call
    //             clientServiceClass += this.generateClientMethodDefinition(methodName, methodType, apiPrefix + this.getEndpointPath(methodName), fnArgs, methodParams, returnType);
    //             clientServiceClass += "\n\n";
    //         }
    //     }
    //     clientServiceClass += "}";

    //     fs.writeFileSync(outputFile, clientServiceClass);
    // }

    public static generateClientServiceFromFile(tsClassFilePath: string, outputFile: string, embedInterfaces: boolean = true) {
        const sourceCode = fs.readFileSync(tsClassFilePath, "utf-8");
        const sourceFile = ts.createSourceFile(tsClassFilePath, sourceCode, ts.ScriptTarget.Latest, true);

        const classDeclaration = sourceFile.statements.filter((x: ts.Statement) => x.kind === ts.SyntaxKind.ClassDeclaration && x.decorators && x.decorators!.length > 0 && (x.decorators![0].expression as any).expression.getText() === "RestAPI")[0] as any as ts.ClassDeclaration;
        let apiPrefix = "";
        const decorator = classDeclaration.decorators ? classDeclaration.decorators[0] : undefined;
        if (decorator && (decorator.expression as any).arguments.length > 0) {
            apiPrefix = (decorator.expression as any).arguments[0].getText().replace(/("|')/g, "");
        }

        const outputDir = path.dirname(outputFile);
        const importFiles: IDictionary<string[]> = {};
        const importFilesAbsolutePaths: string[] = [];
        let clientServiceClass = "";

        if (classDeclaration) {
            clientServiceClass += "import { Injectable } from '@angular/core';\n";
            clientServiceClass += "@Injectable({\n";
            clientServiceClass += "\tprovidedIn: 'root',\n";
            clientServiceClass += "})\n";
            clientServiceClass += "export class " + classDeclaration.name!!.getText() + "Service {\n";
            for (const m in classDeclaration.members) {
                const member = classDeclaration.members[m];
                if (member.kind === ts.SyntaxKind.MethodDeclaration) {
                    const methodDeclaration = member as ts.MethodDeclaration;
                    const methodName = methodDeclaration.name.getText();
                    const methodType = this.getRequestMethodType(methodName);

                    // Collect argument names and types
                    const argumentNames = methodDeclaration.parameters.map((x) => x.name.getText());
                    const argumentTypes = methodDeclaration.parameters.map((x) => x.type!!.getText());

                    // Get return type (excluding Promise< and >)
                    let returnType = methodDeclaration.type ?  methodDeclaration.type!!.getText() : "";
                    returnType = returnType.indexOf("Promise<") === 0 ? returnType.replace(/(Promise<?)|>$/g, "") : returnType;
                    const firstReturnType = returnType.replace(/(\<|\[).*/, "");

                    // Find import statement for return type
                    const importDeclaration = sourceFile.statements.filter((x) => (x as any).importClause && (x as any).importClause.getText().indexOf(firstReturnType) >= 0)[0] as ts.ImportDeclaration;
                    if (importDeclaration && returnType.length > 0) {
                        const originalRelativeImportPathRegExResult = /\"(.|\.|\/)*\"/.exec(importDeclaration.getText());
                        if (originalRelativeImportPathRegExResult && originalRelativeImportPathRegExResult.length > 0 && originalRelativeImportPathRegExResult[0].length > 0) {
                            const originalRelativeImportPath = originalRelativeImportPathRegExResult[0].replace(/(\"|\')/g, "");

                            // Covert relative path from original file to path for new output file
                            const fullImportPath = path.normalize(path.join(path.dirname(tsClassFilePath), originalRelativeImportPath)).replace(/\\/g, "/");
                            const fullPath = `./${fullImportPath}.ts`;

                            const importPath = path.normalize(path.relative(outputDir, fullImportPath));
                            // console.log("import path", importPath, "full path", fullImportPath);
                            if (!importFiles[importPath]) {
                                importFiles[importPath] = [firstReturnType];
                                importFilesAbsolutePaths.push(fullPath);
                            } else if (importFiles[importPath].indexOf(firstReturnType) < 0) {
                                importFiles[importPath].push(firstReturnType);
                                importFilesAbsolutePaths.push(fullPath);
                            }
                        }
                    }

                    // Create method
                    const methodString = this.generateClientMethodDefinition(methodName, methodType, this.getEndpointPath(methodName, apiPrefix), argumentNames, argumentTypes, returnType);
                    clientServiceClass += methodString;
                    clientServiceClass += "";
                }
            }
        }
        clientServiceClass += "}";

        // Add import statements or embed imported classes as interfaces
        if (embedInterfaces) {
            clientServiceClass = this.generateInterfacesForImportFiles(importFilesAbsolutePaths).interfaceDefinitions + clientServiceClass;
        } else {
            clientServiceClass = this.formatImportStatements(importFiles) + clientServiceClass;
        }

        fs.writeFileSync(outputFile,  clientServiceClass);
    }

    /**
     * Goes through import files and creates interfaces
     */
    private static generateInterfacesForImportFiles(importFiles: string[]): { interfaceDefinitions: string, interfaceNames: string[]} {
        let interfaceDefinitions = "";
        let generatedInterfaceNames: string[] = [];

        for (const filename of importFiles) {
            const filenameString = fs.readFileSync(filename, "utf-8");
            const sourceFile = ts.createSourceFile(filename, filenameString, ts.ScriptTarget.Latest, true);

            // Go through all classes and interfaces and generate them
            for (const statement of sourceFile.statements) {
                if (statement.kind === ts.SyntaxKind.ClassDeclaration || statement.kind === ts.SyntaxKind.InterfaceDeclaration || statement.kind === ts.SyntaxKind.EnumDeclaration) {
                    const generatedInterfaces = this.generateInterface(statement as any, true, generatedInterfaceNames);
                    if (generatedInterfaces) {
                        interfaceDefinitions += generatedInterfaces.interfaceDeclarations;
                        interfaceDefinitions += "\n\n";

                        generatedInterfaceNames = generatedInterfaceNames.concat(generatedInterfaces.interfaceNames);

                        // Check what kind of properties does the interface contains
                        const allPropertyTypes = this.getPropertyTypes(statement as any);
                        for (const propertyType of allPropertyTypes) {
                            // skip system data types
                            if (/(string|object|number|any|boolean|number|undefined)/.test(propertyType)) {
                                continue;
                            }

                            // Check if we already have interface for type and if not try to resolve it
                            if (generatedInterfaceNames.indexOf(propertyType) < 0) {
                                const declaration = this.getDeclarationFor(propertyType, sourceFile);
                                this.generateInterface;
                                generatedInterfaceNames.push();
                            }
                        }
                    }
                }
            }
        }
        return { interfaceDefinitions, interfaceNames: generatedInterfaceNames };
    }

    private static getFilePathFromImportDeclaration(importDeclaration: ts.ImportDeclaration, importDeclarationFilePath: string): string | undefined {
        const originalRelativeImportPathRegExResult = /\"(.|\.|\/)*\"/.exec(importDeclaration.getText());
        if (originalRelativeImportPathRegExResult && originalRelativeImportPathRegExResult.length > 0 && originalRelativeImportPathRegExResult[0].length > 0) {
            const originalRelativeImportPath = originalRelativeImportPathRegExResult[0].replace(/(\"|\')/g, "");

            // Covert relative path from original file to path for new output file
            const fullImportPath = path.normalize(path.join(path.dirname(importDeclarationFilePath), originalRelativeImportPath)).replace(/\\/g, "/");
            const fullPath = `./${fullImportPath}.ts`;
            return fullPath;
        } else {
            return undefined;
        }

    }

    private static generateInterface(declaration: ts.ClassDeclaration | ts.InterfaceDeclaration | ts.EnumDeclaration, recursive: boolean, ignoreDeclarations: string[]): { interfaceDeclarations: string, interfaceNames: string[] } {
        const out = {
            interfaceDeclarations : "",
            interfaceNames : [] as string[]
        };

        if (!declaration.name || ignoreDeclarations.indexOf(declaration.name!!.getText()) >= 0) {
            return out;
        }

        if (recursive) {
            // Check what kind of properties does the interface contains
            const allPropertyTypes = this.getPropertyTypes(declaration as any);
            for (const propertyType of allPropertyTypes) {
                // Skip system data types, ignored types and already added types
                if (/(string|object|number|any|boolean|number|undefined)/.test(propertyType) || ignoreDeclarations.indexOf(propertyType) >= 0 || out.interfaceNames.indexOf(propertyType) >= 0) {
                    continue;
                }

                const sourceFile = (declaration as ts.Node).getSourceFile();
                // Check if we already have interface for type and if not try to resolve it
                const childDeclaration = this.getDeclarationFor(propertyType, sourceFile);
                if (childDeclaration) {
                    const childrenInterfaces  = this.generateInterface(childDeclaration as any, recursive, ignoreDeclarations.concat(out.interfaceNames));

                    if (childrenInterfaces.interfaceNames.length > 0) {
                        out.interfaceDeclarations += childrenInterfaces.interfaceDeclarations + "\n\n";
                        out.interfaceNames = out.interfaceNames.concat(childrenInterfaces.interfaceNames);
                    }
                }
            }
        }

        if (declaration.kind === ts.SyntaxKind.ClassDeclaration) {
            const interfaceDeclaration = (declaration as ts.ClassDeclaration);
            const interfaceName = interfaceDeclaration.name!!.getText();

            let interfaceDef = "interface " + interfaceName + " {\n";

            // Go through all properties and output them in output string
            for (const member of interfaceDeclaration.members) {
                if (member.kind === ts.SyntaxKind.PropertyDeclaration) {
                    const propertyName = (member as ts.PropertyDeclaration).name.getText();
                    const propertyType = (member as any).type ? (member as ts.PropertyDeclaration).type!!.getText() : undefined;

                    if (propertyName && propertyType) {
                        interfaceDef += `\t${propertyName}: ${propertyType};\n`;
                    }
                }
            }

            interfaceDef += "}\n\n";

            out.interfaceDeclarations += interfaceDef;
            out.interfaceNames.push(interfaceName);

        } else if (declaration.kind === ts.SyntaxKind.InterfaceDeclaration) {
            out.interfaceDeclarations += declaration.getText();
            out.interfaceNames.push(declaration.name.getText());
        } else if ((declaration as any).kind === ts.SyntaxKind.EnumDeclaration) {
            out.interfaceDeclarations += (declaration as ts.EnumDeclaration).getText();
            out.interfaceNames.push((declaration as ts.EnumDeclaration).name.getText());
        }
        return out;
    }

    private static getPropertyTypes(declaration: ts.ClassDeclaration | ts.InterfaceDeclaration): string[] {
        const types: string[] = [];

        for (const member of declaration.members) {
            if (member.kind === ts.SyntaxKind.PropertySignature || member.kind === ts.SyntaxKind.PropertyDeclaration) {
                const type = (member as ts.PropertyDeclaration).type;
                const t = type ? type!!.getText() : undefined;
                if (t && types.indexOf(t) < 0) {
                    types.push(t);
                }
            }
        }
        return this.sanitizeTypes(types);
    }

    private static sanitizeTypes(types: string[]): string[] {
        const outTypes: string[] = [];
        const newTypes = types.map((x) => x.replace(/(\[\]|<|>)/g, " "));

        for (const item of newTypes) {
            const splitItems = item.split(" ");
            for (const si of splitItems) {
                if (si.length > 0 && outTypes.indexOf(si) < 0) {
                    outTypes.push(si);
                }
            }
        }
        return outTypes;
    }

    private static getDeclarationFor(declarationName: string, file: ts.SourceFile): ts.DeclarationStatement | undefined {
        // Go through all classes and interfaces and try to find the declaration
        for (const statement of file.statements) {
            if ((statement.kind === ts.SyntaxKind.ClassDeclaration || statement.kind === ts.SyntaxKind.InterfaceDeclaration || statement.kind === ts.SyntaxKind.EnumDeclaration) && (statement as any).name && (statement as any).name!!.getText() === declarationName) {
                return statement as ts.DeclarationStatement;
            } else if (statement.kind === ts.SyntaxKind.ImportDeclaration) {
                const importDeclaration = statement as ts.ImportDeclaration;
                // try to search for declaration in a imported file file
                if (importDeclaration.importClause && importDeclaration.importClause!!.getText().indexOf(declarationName) > 0) {
                    const importPath = this.getFilePathFromImportDeclaration(importDeclaration, file.fileName);
                    if (importPath) {
                        const filenameString = fs.readFileSync(importPath, "utf-8");
                        const sourceFile = ts.createSourceFile(importPath, filenameString, ts.ScriptTarget.Latest, true);
                        const declaration = this.getDeclarationFor(declarationName, sourceFile);
                        if (declaration) {
                            return declaration;
                        }
                    }
                }
            }
        }
        return undefined;
    }

    /**
     * Converts dictionary that contains file paths as keys and array of class/interface
     * names as values into typescript import statements
     */
    private static formatImportStatements(importFiles: IDictionary<string[]>): string {
        // Generate import statements
        let importStatements = "";
        for (const file in importFiles) {
            importStatements += this.generateImportStatement(importFiles[file], file);
        }
        importStatements += "\n";
        return importStatements;
    }

    private static generateImportStatement(classNames: string[], sourceFilePath: string): string {
        return `import { ${classNames.join(", ")} } from "${sourceFilePath}";`;
    }

    private static generateClientMethodDefinition(methodName: string, methodType: string, urlEnpoint: string, argumentNames: string[], argumentTypes: string[], returnType: string): string {
        if (argumentNames.length !== argumentTypes.length) {
            throw new Error("Length of method types and argument names does not match!");
        }

        let methodString = "\tpublic async " + methodName + "(";
        let params = "";
        let hasBody = false;
        // Function arguments
        for (let i = 0; i < argumentNames.length; i++) {
            methodString += argumentNames[i] + ": " + argumentTypes[i];
            if (i !== argumentNames.length - 1) {
                methodString += ", ";
            }

            if (argumentNames[i] === "body" && (methodType === "put" || methodType === "post")) {
                hasBody = true;
            } else {
                params += `
                if(${argumentNames[i]}){
                    searchParams.set("${argumentNames[i]}", ${argumentNames[i]}.toString());
                }`;
            }
        }

        if (returnType && returnType.length > 0) {
            methodString += "): Promise<" + returnType + "> {\n";
        } else {
            methodString += "): Promise<void> {\n";
        }

        // Add search parameters
        methodString += "const searchParams = new URLSearchParams()\n";
        if (params.length > 0) {
            methodString += params;
        }

        // Method implementation
        methodString += `
        const u = new URL(window.location.protocol + "//" + window.location.host + "${urlEnpoint}");
        u.search = searchParams.toString();`;

        if (hasBody) {
            methodString += `
            const response = await fetch(u as any, {
                method : "${methodType.toUpperCase()}",
                headers:{'content-type': 'application/json'},
                body : JSON.stringify(body)
            });
            `;
        } else {
            methodString += `
            const response = await fetch(u as any, {
                method : "${methodType.toUpperCase()}"
            });
            `;
        }

        methodString += `
        try {
            const data = await response.json();
            if (data.result) {
                return data.result;
            }else if (data.error) {
                throw new Error(data.error);
            }else{
                return;
            }
        } catch (e) {
            if(response.status === 200){
                //Success just no result
                return;
            }else{
                throw e;
            }
        }`;
        methodString += `\n\t}\n`;

        return methodString;
    }

    // Argument in this case is usually function
    private static getStringTypeFromReflectionType(type: any): string {
        return type.name.replace("String", "string").replace("Number", "number").replace("Boolean", "boolean").replace("Object", "object").replace("Array", "any[]");
    }

    private static getEndpointPath(methodName: string, prefix?: string): string {
        if (prefix && prefix.indexOf("/") === prefix.length - 1) {
            prefix = prefix.substr(0, prefix.length - 2);
        } else if (!prefix) {
            prefix = "";
        }
        return  prefix + "/" + methodName.replace(/([A-Z])/g, (g) => "-" + g[0].toLowerCase());
    }

    private static getRequestMethodType(methodName: string): string {
        let methodType = "get";
        if (methodName.startsWith("post")) {
            methodType = "post";
        } else if (methodName.startsWith("put")) {
            methodType = "put";
        } else if (methodName.startsWith("delete")) {
            methodType = "delete";
        }

        return methodType;
    }

    private static getFunctionArgs(func: any): string[] {
        return (func + "")
          .replace(/[/][/].*$/mg, "") // strip single-line comments
          .replace(/\s+/g, "") // strip white space
          .replace(/[/][*][^/*]*[*][/]/g, "") // strip multi-line comments
          .split("){", 1)[0].replace(/^[^(]*[(]/, "") // extract the parameters
          .replace(/=[^,]+/g, "") // strip any ES6 defaults
          .split(",").filter(Boolean); // split & filter [""]
    }
}
