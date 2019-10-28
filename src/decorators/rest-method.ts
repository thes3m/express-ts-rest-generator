import "reflect-metadata";

/**
 * Decorated a class method to be exported as a rest method. 
 * @param target 
 * @param key 
 * @param descriptor 
 */
export function RestMethod(target: any, key: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor {

    // return edited descriptor as opposed to overwriting the descriptor
    return descriptor;
}
