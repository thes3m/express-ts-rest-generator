import { RestAPI } from '../decorators/rest-api';
import { RestMethod } from '../decorators/rest-method';


export class RestClass {
    data = ["test", "test2", "test3"];

    getData(count: number) : any[]{
        return this.data;
    }
}

@RestAPI("")
export class RestClassWithoutExposedMethods {
    data = ["test", "test2", "test3"];

    getData(count: number) : any[]{
        return this.data;
    }
}

@RestAPI("")
export class RestClassWithExposedMethods {
    data = ["test", "test2", "test3"];

    @RestMethod
    getData(count: number) : any[]{
        return this.data;
    }
}