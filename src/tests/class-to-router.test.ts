import { expect } from 'chai';
import { ExpressRESTGenerator } from '../express-rest-generator';
import { RestAPI } from '../decorators/rest-api';
import { RestMethod } from '../decorators/rest-method';


@RestAPI()
class TestRestRouter{
    data = ["test", "test2", "test3"];

    @RestMethod
    getData(count: number) : any[]{
        return this.data;
    }
}

// if you used the '@types/mocha' method to install mocha type definitions, uncomment the following line
// import 'mocha';

describe('Hello function', () => {
  it('should return hello world', () => {
    const classInstance = new TestRestRouter();
    const router = ExpressRESTGenerator.convertClassToExpressRouter(classInstance);
    expect(router).to.not.be.undefined;
  });
});