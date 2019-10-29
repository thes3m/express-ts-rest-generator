import "reflect-metadata";

/**
 * Decorates a class to be used as a REST API
 * @param apiPrefix
 */
export function RestAPI(apiPrefix?: string) {
    return (target: any) => {
        Reflect.defineMetadata("apiPrefix", apiPrefix || "", target.prototype);
    };
}
