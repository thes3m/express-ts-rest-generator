import { RestAPI } from "../decorators/rest-api";
import { RestMethod } from "../decorators/rest-method";


export class RestClass {
    public data = ["test", "test2", "test3"];

    public getData(count: number): any[] {
        return this.data;
    }
}

@RestAPI("")
export class RestClassWithoutExposedMethods {
    public data = ["test", "test2", "test3"];

    public getData(count: number): any[] {
        return this.data;
    }
}

@RestAPI("")
export class RestClassWithExposedMethods {
    public data = ["test", "test2", "test3"];

    @RestMethod
    public getData(count: number): any[] {
        return this.data;
    }
}
