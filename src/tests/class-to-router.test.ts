import { expect } from 'chai';
import { Router } from "express";
import { ExpressRESTGenerator } from '../express-rest-generator';
import { RestAPI } from '../decorators/rest-api';
import { RestClass,RestClassWithExposedMethods, RestClassWithoutExposedMethods } from './empty-classes';
import { IDictionary } from '../interfaces/dictionary';


interface ResponseValue{
    result?: IDictionary<any>,
    error?: string,
    code : number,
}

// if you used the '@types/mocha' method to install mocha type definitions, uncomment the following line
// import 'mocha';

describe('ExpressRESTGenerator', () => {
  let getRouterPaths = (router: Router) => {
    return router.stack.filter(r => r.route).map(r => r.route.path);
  }

  it('should not create a rest endpoint', () => {
    const classInstance = new RestClass();
    
    expect(()=> ExpressRESTGenerator.convertClassToExpressRouter(classInstance)).to.throw;
  });

  it('should create an endpoint without any methods', () => {
    const classInstance = new RestClassWithoutExposedMethods();
    const router = ExpressRESTGenerator.convertClassToExpressRouter(classInstance);
    
    expect(getRouterPaths(router)).to.eql([]);
  });

  it('should create an endpoint with one method', () => {
    const classInstance = new RestClassWithExposedMethods();
    const router = ExpressRESTGenerator.convertClassToExpressRouter(classInstance);
    expect(router).to.not.be.undefined;
    expect(getRouterPaths(router)).to.eql(["/get-data"]);
  });
});