import * as _ from "lodash";
import {CustomError, Logger} from 'sw-logger';
import {validate, ValidationOptions, registerDecorator, ValidationArguments} from "class-validator";
import {sanitize} from 'class-sanitizer';
export * from 'class-validator';
export * from 'class-sanitizer';
const tracer = new Logger();


// export function strict(isStrict: boolean) {
//     return function (target: any, propertyName?:string, parameterIndex?:number) {
//         if (isStrict != true) {
//             return target;
//         }
//         // The new constructor behaviour
//         let f: any = function (...args: Array<any>) {
//             let c = new target(...args);
//             console.log("registering isStrict", c);
//             registerDecorator({
//                 name: "isStrict",
//                 target: c.constructor,
//                 propertyName: "#",
//                 options: {
//                     message: (value?: any, constraint1?: any, constraint2?: any) => {
//                         return `keys [${value.object._unregisteredFields.toString()}] are not allowed in strict mode`;
//                     }
//                 } as ValidationOptions,
//                 validator: {
//                     validate(value: any, args: ValidationArguments) {
//                         console.log("validate-strict", args.object);
//                         return (args.object as any)._unregisteredFields.length == 0;
//                     }
//                 }
//             });
//             return c;
//         }.bind(this);
//         // copy prototype so intanceof operator still works
//         f.prototype = target.prototype;
//         // return new constructor (will override target)
//         return f;
//     };
// };


export function IsDatable(validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
        registerDecorator({
            name: "isDatable",
            target: object.constructor,
            propertyName: propertyName,
            options: _.extend({
                message: "must be an ISODate string or a Date object"
            }, validationOptions),
            validator: {
                validate(value: any, args: ValidationArguments) {
                    let obj: any = args.object;
                    return _.isDate(obj[propertyName]) || /\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)/.test(obj[propertyName])
                }
            }
        });
    };
}


export function Strict(isStrict: boolean, validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) { //propertyName is here not used
        if (!isStrict)
            return;
        registerDecorator({
            name: "isStrict",
            target: object.constructor,
            propertyName: "#",
            options: _.extend({
                message: (value: any) => {
                    return `keys [${value.object._unregisteredFields.toString()}] are not allowed in strict mode`;
                }
            }, validationOptions),
            validator: {
                validate(value: any, args: ValidationArguments) {
                    let obj: any = args.object;
                    return obj._unregisteredFields.length == 0;
                }
            }
        });
    };
};


export abstract class Schema {

    private _declaredFields: Map<string,any>;
    private _unregisteredFields: Array<string>;

    constructor(...fields: Array<any>) {
        //Clean fields
        let declaredFields: any = new Map();
        fields.forEach(function (f) {
            if (_.isString(f))
                declaredFields.set(f, null);
            else if (_.isPlainObject(f))
                declaredFields.set(_.keys(f)[0], f[_.keys(f)[0]]);
            else
                throw new CustomError("invalidField", "field %k must be either a string or a composed key {key:constructor}", f, 500, "fatal");
        });
        Object.defineProperties(this, {
            _declaredFields: {
                value: declaredFields,
                enumerable: false,
                writable: false,
                configurable: false
            },
        });
        Object.defineProperties(this, {
            _unregisteredFields: {
                value: [],
                enumerable: false,
                writable: true,
                configurable: true
            },
        });
        //todo: fields `toSchema`, `toJSON`, `fromSchema` are prohibited
        if (this._declaredFields.size == 0)
            throw new CustomError('noDeclaredFields', 'one declared field is at least required', 500, 'fatal');
    }


    public toSchema(): Object {
        let obj: any = {};
        for (let [k, v] of this._declaredFields) {
            if (v != void 0 && (this as any)[k] != void 0) { //Nested object
                let targetSchema = (this as any)[k];
                if (_.isArray(targetSchema)) {
                    // targetSchema = targetSchema[0];
                    obj[k] = [];
                    for (let cur of targetSchema) {
                        if ((cur as any).toSchema == void 0)
                            throw new CustomError("toSchemaMissing", "method toSchema() is missing on object %k", k, "fatal");
                        obj[k].push((cur as any).toSchema());
                    }
                } else {
                    if (targetSchema.toSchema == void 0)
                        throw new CustomError("toSchemaMissing", "method toSchema() is missing on object %k", k, "fatal");
                    obj[k] = targetSchema.toSchema();
                }
            }
            else if (typeof (this as any)[k] != 'undefined')
                obj[k] = (this as any)[k];
        }
        return obj;
    }

    public toJSON(): Object {
        return this.toSchema();
    }

    private async _populateFromSchema(schema: any): Promise<any> {
        let _this: any = this;
        for (let k in schema) {
            let v = schema[k];
            if (!this._declaredFields.has(k))
                this._unregisteredFields.push(k);
            else if (this._declaredFields.get(k) == void 0)
                _this[k] = v;
            else if (_.isArray(this._declaredFields.get(k))) {
                if (_.isArray(schema[k])) {
                    _this[k] = [];
                    for (let el of schema[k]) {
                        let sub = new (this._declaredFields.get(k)[0])();
                        if (sub._populateFromSchema == void 0)
                            throw new CustomError("fromSchemaMissing", "method fromSchema() is missing on object %k", k, "fatal");
                        // if (_.isPlainObject(el)) {
                        _this[k].push(await sub._populateFromSchema(el));
                        // } else {
                        //     throw new CustomError("parseError", "%k is declared as an Array of %s but you supplied '%o'", k, _this._declaredFields.get(k)[0].name, el, "fatal");
                        // }
                    }
                } else {
                    _this[k] = null;
                }
            }
            else {
                let sub = new (this._declaredFields.get(k))();
                if (sub._populateFromSchema == void 0)
                    throw new CustomError("fromSchemaMissing", "method fromSchema() is missing on object %k", k, "fatal");
                // if (_.isPlainObject(schema[k]))
                _this[k] = await sub._populateFromSchema(schema[k]);
                // else
                //     throw new CustomError("parseError", "%k is declared as a tpye '%s' but you supplied an %s (%s)", k, _this._declaredFields.get(k).name, typeof schema[k], schema[k], "fatal");
            }
        }
        return _this;
    }

    public static async fromSchema<T>(schema: any): Promise<T> {
        let _this: T = new (this as any).prototype.constructor(); //new instance
        if (_.isPlainObject(schema))
            await (_this as any)._populateFromSchema(schema);
        //Validate
        let errors = await validate(_this, {validationError: {target: false}});
        if (errors.length) {
            throw new CustomError("invalidSchema", "schema is invalid", {validationErrors: errors}, 500, "fatal");
        }
        sanitize(_this);
        return _this;
    }
}



