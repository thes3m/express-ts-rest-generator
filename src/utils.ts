export class Utils {

    // Regular expression that can be used to test if a type is a primitive type (string,number,boolean)
    public static primitiveTypeRegex = /(string|number|boolean|number)/;

    public static getEndpointPath(methodName: string, prefix?: string): string {
        if (prefix && prefix.indexOf("/") === prefix.length - 1) {
            prefix = prefix.substr(0, prefix.length - 2);
        } else if (!prefix) {
            prefix = "";
        }
        return  prefix + "/" + methodName.replace(/([A-Z])/g, (g) => "-" + g[0].toLowerCase());
    }

    public static getRequestMethodType(methodName: string, methodArgumentTypes: string[]): string {
        let methodType = "get";
        if (methodName.startsWith("post")) {
            methodType = "post";
        } else if (methodName.startsWith("put")) {
            methodType = "put";
        } else if (methodName.startsWith("delete")) {
            methodType = "delete";
        } else {
            // Check if any of the method arguments contains complex objects and in that case return post method
            for (const argType of methodArgumentTypes) {
                if (this.primitiveTypeRegex.test(argType) === false) {
                    methodType = "post";
                    break;
                }
            }
        }

        return methodType;
    }
    public static getFunctionArgs(func: any): string[] {
        return (func + "")
          .replace(/[/][/].*$/mg, "") // strip single-line comments
          .replace(/\s+/g, "") // strip white space
          .replace(/[/][*][^/*]*[*][/]/g, "") // strip multi-line comments
          .split("){", 1)[0].replace(/^[^(]*[(]/, "") // extract the parameters
          .replace(/=[^,]+/g, "") // strip any ES6 defaults
          .split(",").filter(Boolean); // split & filter [""]
    }
}
