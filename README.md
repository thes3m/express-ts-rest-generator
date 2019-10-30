# Express TS REST Generator

Writing REST API on the server side can take quite some time and it takes even more time to implement client side code that fetches and parses data from REST endpoints. `express-ts-rest-generator` was created to simplify that process and provide methods that allow you to expose a class from server side to the client side and generate a service class that will connect to the server endpoints. While doing this it preserves method signatures so the client class will contain same method signatures and parameters as on the server side and since the process is automated you can simply recompile and get the new interfaces when the server API changes.

`express-ts-rest-generator` is a Typescript library for generating Express Router from Typescript class and client side class for connecting to the same generated REST API. By fully utilizing this library you can eliminate an option for writing a REST API on client and server side and simply use same method calls on the client side as you wrote class on the server side while the library transparently hides the logic of how both of them comunicate between eachother. 

The library contains 2 parts:
* the utilities that converts a Typescript class to express `Router` to be used with `express`
* utilities that generate client code from TS class that can be used to fetch data from server endpoints

You are also welcome to use just one part if you wish so.

## How to install

```
npm install express-rest-api-generator
```

# How to use

## Generating express Router

`express-ts-rest-generator` can generate REST endpoints from Typescript class. In order to do so you need to annotate the class with `@RestApi` and each method with `@RestMethod` like this:

```ts
@RestAPI("API/v1")
export class REST {
    private items: any[] = ["item1", "item2", "item3"];

    @RestMethod
    public getItems(): any[] {
        return items;
    }

    @RestMethod
    public storeItem(item: string): boolean {
        this.items.push(item);
        return true;
    }
}
```

Class can be exposed via REST api like this:

```ts
import * as express from "express";
import { ExpressRESTGenerator } from "express-ts-rest-generator";

let app = express()
app.use(bodyParser.json());

const r = new REST();
app.use(ExpressRESTGenerator.convertClassToExpressRouter(r));

app.listen(8080)
```

When the express server is started you can interact with the REST API via

* `localhost:8080/API/v1/get-items`
* `localhost:8080/API/v1/set-item?item?=newItem`

`express-ts-rest-generator` exposes class methods by renaming methods to dash-case. Method parameters are converted to query parameters and need to be supplied via query parameters. Complex method argument datatypes will be accepted via request body. If method specifies `objects`/`classes`/`interfaces` as method parameters then the endpoint will use `POST` method instead of `GET`, which is used by default.

If you wish to use a specific method type then you can prefix your method with method type. For example if you wish to have a `POST` method on a method `setEntity()` you can simply name the method `postEntity()` or `postSetEntity()` instead. You can do the same with `PUT`, `UPDATE` and other methods. 

Endpoint responses return JSON results. Returned values are equal to serialized  values that are returned by the class methods, which means class properties are kept while methods are removed. On top of that each result is wrapped into another object that contains a property with a `result` if request is successful and `error` in case of failure. For example method `localhost:8080/API/v1/get-items` would return the following JSON:

```json
{
    result : ["item1", "item2","item3"]
}
```

In case of error a response will have a status code of 500 and a json describing an error:

```json
{
    error : "Something went wrong"
}
```

## Generating client service class

You can automatically generate class that can be used on the frontend with the following code:

```ts
import { ClientRestGenerator } from "express-ts-rest-generator";

ClientRestGenerator.generateClientServiceFromFile("./rest.ts","./generated/rest.service.ts");

```

The first argument `ClientRestGenerator.generateClientServiceFromFile` is the filepath to the typescript class for which we would like to generate the service. The class must again contain `@RestApi` and `@RestMethod` annotations in order to generate the client class. The second argument is the destination where we want to save the generated class. The third argument is options but it determins for what kind of client we would like to generate the class. Currently supported options are `"fetch"` and `"angular"`. The class will then be appropriately prepaired for client. 

The `fetch` generator is a default generator that uses `fetch()` method that is implemented in browser to retrive data from server. `angular` implementation uses the same API, but it adds additional decorator so that we ca use the class as a service.

For the `REST` class above the generated client code would look like this:

```ts

export class RESTService {
	public serverUrl = window.location.protocol + "//" + window.location.host;

    public async request(urlPath: string, method: string, queryParams?: any, body?: any, headers?: any): Promise<any> {
        const searchParams = new URLSearchParams();

        if (queryParams) {
            // tslint:disable-next-line: forin
            for (const paramName in queryParams) {
                searchParams.set(paramName, queryParams[paramName]);
            }
        }

        const u = new URL(this.serverUrl + urlPath);
        u.search = searchParams.toString();

        const bodyData: any = {
            method,
        };
        if (body) {
            bodyData.headers = { "content-type": "application/json"};
            bodyData.body = JSON.stringify(body);
        }

        const response = await fetch(u as any, bodyData);

        try {
            const data = await response.json();
            if (data.result) {
                return data.result;
            } else if (data.error) {
                throw new Error(data.error);
            } else {
                return;
            }
        } catch (e) {
            throw e;
        }
    }
    public async getItems(): Promise<any[]> {
        return this.request("API/v1/get-items", "get", undefined, undefined);
    }
    public async storeItem(item: string): Promise<boolean> {
        return this.request("API/v1/store-item", "get", {item}, undefined);
    }
}

```

You can then include generated code on the on your frontend to use the code on the client side and retrive server data. 

For developement purposes you can can either put the code that generates client code into file that starts server and regenerate interfaces each time that server is started or you can put it in a separate file and then execute that script whenever you need to regenerate client code with `node ./generate-rest.ts`.

## Additional settings

You can pass additional settings to rest generator via options argument. If your file contains multiple classes and you wish to specify specific classname from which you would like to generate REST API you can use:

```ts
ClientRestGenerator.generateClientServiceFromFile("./rest.ts","generated/rest.service.ts","fetch",{
    className : "REST"
});
```

By default all interfaces/classes are imported into service class, however if you wish to embed them in the service file you can use:

```ts
ClientRestGenerator.generateClientServiceFromFile("./rest.ts","generated/rest.service.ts","fetch",{
    embedInterfaces : true
});
```

in this case the generator will create all interfaces and embed them on the top of client file. Embedded interfaces will contain only definitions for properties, while methods will be removed.

## Implementing custom generator for client side

To implement custom generator for client side you can extend the `FetchRestGenerator` class and then override methods to adapt generator to your needs: 

```ts
export class CustomRestGenerator extends FetchRestGenerator {
    public generateClientServiceFromFile(tsClassFilePath: string, outputFile: string, settings?: IClientGeneratorSettings): string  {
        //Modify generated code or generate custom code here
        const result = super.generateClientServiceFromFile(tsClassFilePath, outputFile, settings);
        return result;
    }
}
```

Custom generator can then be used like this:

```ts
import { ClientRestGenerator } from "express-ts-rest-generator";
import { CustomRestGenerator } from "./custom-rest-generator";

ClientRestGenerator.generateClientService("./rest.ts","generated/rest.service.ts", new CustomRestGenerator());
```