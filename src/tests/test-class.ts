import { RestAPI } from "../../dist/decorators/rest-api";
import { RestMethod } from "../../dist/decorators/rest-method";

@RestAPI("API/v1")
export class REST {
    private items: any[] = ["item1", "item2", "item3"];

    @RestMethod
    public getItems(): any[] {
        return this.items;
    }

    @RestMethod
    public storeItem(item: string): boolean {
        this.items.push(item);
        return true;
    }
}
