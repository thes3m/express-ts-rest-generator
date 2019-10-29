import "reflect-metadata";

/**
 * Decorated a class method to be exported as a rest method.
 * @param target
 * @param key
 * @param descriptor
 */
export function RestMethod(target: any, key: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor {
    Reflect.defineMetadata("restmethod", true, target.constructor.prototype, key);
    return descriptor;
}
