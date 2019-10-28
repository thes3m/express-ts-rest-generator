# Express API Generator

Express API generator is a Typescript library for generating REST API from Typescript class and client side class for connecting to the same generated REST API. By fully utilizing this library you can eliminate an option for writing a REST API and client side code and simply use same method calls on the client side as you wrote class on the server side while the library transparently hides the logic

## How to install

```
npm install express-rest-api-generator
```

# How to use

`express-api-generator` can generate REST endpoints from Typescript class. In order to do so you need to annotate the class with `@RestApi` and each method with `@RestMethod`. For example class like this:

```
@RestApi("/API/v1")
export class REST {
    var items: any[] = ["item1", "item2","item3"];

    @RestMethod
    getItems : any[] {
        return items;
    }

    @RestMethod
    storeItem(item: string): Promise<boolean>{
        this.items.push(item);
    }
}
```

can be exposed via REST api like this:

```
import * as express from "express";
import { ExpressRESTGenerator } from "express-api-generator";

let app = express()
app.use(bodyParser.json());

const r = new REST();
app.use(ExpressRESTGenerator.convertClassToExpressRouter(r));

app.listen(8080)
```

When the express server is started you can interact with the REST API via

* `localhost:8080/API/v1/get-items`
* `localhost:8080/API/v1/set-item?item?=newItem`

`ExpressRESTGenerator` exposes class methods by renaming mehods to dash-case. Method parameters are converted to query parameters and need to be supplied via query parameters, except `body` parameter. If `body` parameter is specified then the endpoint will use `POST` method instead of `GET`, which is used by default.

