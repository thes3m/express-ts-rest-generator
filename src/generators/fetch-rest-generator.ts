import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";
import { IDictionary } from "../interfaces/dictionary";
import { Utils } from "../utils";
import { IClientGeneratorSettings } from "./client-generator-settings";
import { IRestGenerator } from "./rest-generator";

export class FetchRestGenerator implements IRestGenerator {
    /**
     * Generates a class that can be used on a frontend/client for retriving requests from REST server.
     * @param tsClassFilePath path to typescript class that contains class with @RestApi and @RestMethod annotations
     * @param className name of class that we would like to expose
     * @param outputFile  path to output file where we would like to save the generated service class
     * @param embedInterfaces if false then external classes/interfaces will be imported and if true then they will be inlined
     */
    public generateClientServiceFromFile(tsClassFilePath: string, outputFile: string, settings?: IClientGeneratorSettings): string {
        if (!fs.existsSync(tsClassFilePath)) {
            throw new Error("Cannot find TS file from path:" + tsClassFilePath);
        }

        const sourceCode = fs.readFileSync(tsClassFilePath, "utf-8");
        const sourceFile = ts.createSourceFile(tsClassFilePath, sourceCode, ts.ScriptTarget.Latest, true);

        // Check if AST was generated and if not then throw error
        if (!sourceFile) {
            throw new Error(`Error parsing typescript source file ${tsClassFilePath} !`);
        }

        // Find class declaration of type Class declaration that has decorators and that its name is equal to classes name that we require
        const classDeclaration = sourceFile.statements.filter((x: ts.Statement) => {
            return x.kind === ts.SyntaxKind.ClassDeclaration &&
                    x.decorators && x.decorators!.length > 0 &&
                    ( (settings && (x as any).name.getText() === settings.className) ||
                      (!settings || !settings.className)
                    );
                })[0] as any as ts.ClassDeclaration;

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
            clientServiceClass += "export class " + classDeclaration.name!!.getText() + "Service {\n";
            clientServiceClass += "\t serverUrl = window.location.protocol + '//' + window.location.host\n\n";
            clientServiceClass += this.generateRequestMethod();

            for (const m in classDeclaration.members) {
                const member = classDeclaration.members[m];
                if (member.kind === ts.SyntaxKind.MethodDeclaration) {
                    const methodDeclaration = member as ts.MethodDeclaration;
                    const methodName = methodDeclaration.name.getText();

                    // Collect argument names and types
                    const argumentNames = methodDeclaration.parameters.map((x) => x.name.getText());
                    const argumentTypes = methodDeclaration.parameters.map((x) => x.type ? x.type.getText() : "any");
                    const methodType = Utils.getRequestMethodType(methodName, argumentTypes);

                    // Check if input parameter is anything other than basic type
                    const nonPrimitiveTypes = argumentTypes.filter((x) => /(string|number|boolean|any|object)/.test(x) === false);
                    if (nonPrimitiveTypes.length > 0) {
                        throw new Error(`ERROR, detected non primitive type in ${classDeclaration.name!!.getText()}.${methodName}!`);
                    }
                    // Get return type (excluding Promise< and >)
                    let returnType = methodDeclaration.type ?  methodDeclaration.type!!.getText() : "";
                    returnType = returnType.indexOf("Promise<") === 0 ? returnType.replace(/(Promise<?)|>$/g, "") : returnType;
                    const allReturnTypes = returnType.replace(/(<|>|\[|\])/g, " ").split(" ").map((x) => x.trim()) .filter((x) => x.length > 0);

                    // Find import statement for return type (returm type can have nested types so resolve those)
                    for (const rt of allReturnTypes) {
                        const importDeclaration = sourceFile.statements.filter((x) => (x as any).importClause && (x as any).importClause.getText().indexOf(rt) >= 0)[0] as ts.ImportDeclaration;
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
                                    importFiles[importPath] = [rt];
                                    importFilesAbsolutePaths.push(fullPath);
                                } else if (importFiles[importPath].indexOf(rt) < 0) {
                                    importFiles[importPath].push(rt);
                                    importFilesAbsolutePaths.push(fullPath);
                                }
                            }
                        }
                    }

                    const optionalArgs = methodDeclaration.parameters.filter((x) => {
                            return x.questionToken || x.initializer || x.dotDotDotToken;
                        }).map((x) => {
                            return x.name.getText();
                    });

                    // Create method
                    const methodString = this.generateClientMethodDefinition(methodName, methodType, Utils.getEndpointPath(methodName, apiPrefix), argumentNames, argumentTypes, optionalArgs, returnType);
                    clientServiceClass += methodString;
                    clientServiceClass += "\n";
                }
            }
        }
        clientServiceClass += "}";

        // Add import statements or embed imported classes as interfaces
        if (settings && settings.embedInterfaces) {
            clientServiceClass = this.generateInterfacesForImportFiles(importFilesAbsolutePaths).interfaceDefinitions + clientServiceClass;
        } else {
            clientServiceClass = this.formatImportStatements(importFiles) + clientServiceClass;
        }

        return clientServiceClass;
    }


    /**
     * Generates rest method that will be used by all other REST api calls (this will be the main rest method)
     */
    protected generateRequestMethod(): string {
        const method =
    `
    public async request(urlPath: string, method:string, queryParams?: any, body?: any, headers?: any): Promise<any> {
        const searchParams = new URLSearchParams()

        if(queryParams){
            // tslint:disable-next-line: forin
            for(let paramName in queryParams){
                if(queryParams[paramName] !== undefined){
                    searchParams.set(paramName, queryParams[paramName]);
                }
            }
        }

        const u = new URL(this.serverUrl + urlPath);
        u.search = searchParams.toString();

        let bodyData: any = {
            method : method
        }
        if(body){
            bodyData["headers"] = { "content-type": "application/json"};
            bodyData["body"] = JSON.stringify(body);
        }
        //TODO other headers

        const response = await fetch(u as any, bodyData);

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
            throw e;
        }
    }`;

        return method;
    }

    /**
     * Goes through import files and creates interfaces
     */
    protected generateInterfacesForImportFiles(importFiles: string[]): { interfaceDefinitions: string, interfaceNames: string[]} {
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

    protected getFilePathFromImportDeclaration(importDeclaration: ts.ImportDeclaration, importDeclarationFilePath: string): string | undefined {
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

    /**
     * Generates interfaces for specified declaration (also includes child interface declarations). Returns array of generated interface names and stirng that contains all interface definitions
     * @param declaration
     * @param recursive
     * @param ignoreDeclarations
     */
    protected generateInterface(declaration: ts.ClassDeclaration | ts.InterfaceDeclaration | ts.EnumDeclaration, recursive: boolean, ignoreDeclarations: string[]): { interfaceDeclarations: string, interfaceNames: string[] } {
        const out = {
            interfaceDeclarations : "",
            interfaceNames : [] as string[],
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

    protected getPropertyTypes(declaration: ts.ClassDeclaration | ts.InterfaceDeclaration): string[] {
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

    protected sanitizeTypes(types: string[]): string[] {
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

    protected getDeclarationFor(declarationName: string, file: ts.SourceFile): ts.DeclarationStatement | undefined {
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
    protected formatImportStatements(importFiles: IDictionary<string[]>): string {
        // Generate import statements
        let importStatements = "";
        for (const file in importFiles) {
            importStatements += this.generateImportStatement(importFiles[file], file);
            importStatements += "\n";
        }
        return importStatements;
    }

    protected generateImportStatement(classNames: string[], sourceFilePath: string): string {
        return `import { ${classNames.join(", ")} } from "${sourceFilePath.replace(/\\/g, "/")}";`;
    }

    protected generateClientMethodDefinition(methodName: string, methodType: string, urlEnpoint: string, argumentNames: string[], argumentTypes: string[], optionalArgs: string[], returnType: string): string {
        if (argumentNames.length !== argumentTypes.length) {
            throw new Error("Length of method types and argument names does not match!");
        }

        let methodArgs = "";
        let params = "";
        let body = "";

        for (let i = 0; i < argumentNames.length; i++) {
            const posix = optionalArgs.indexOf(argumentNames[i]) >= 0 ? "?" : "";

            methodArgs += argumentNames[i] + posix + ": " + argumentTypes[i];
            if (i !== argumentNames.length - 1) {
                methodArgs += ", ";
            }

            if (methodType !== "get") {
                if (body.length === 0) {
                    body += "{";
                }
                body += argumentNames[i] + ": " + argumentNames[i] + ",";
            } else {
                if (params.length === 0) {
                    params += "{";
                }
                params += argumentNames[i] + ": " + argumentNames[i] + ",";
            }
        }

        if (body.length > 0) {
            body += "}";
        } else {
            body = "undefined";
        }

        if (params.length > 0) {
            params += "}";
        } else {
            params = "undefined";
        }

        // If method returns a value then set return type to a specified return type
        if (returnType.length > 0) {
            returnType = ": Promise<" + returnType + ">";
        } else {
            returnType = ": Promise<void>";
        }
        const methodString = `
    public async ${methodName}(${methodArgs}) ${returnType}{
        return this.request("${urlEnpoint}","${methodType}",${params},${body});
    }`;

        return methodString;
    }
}
