import * as _ from "lodash";
import {CustomError, Logger} from 'sw-logger';
import {
    validate, ValidationOptions, registerDecorator, ValidationArguments, IsURLOptions,
    IsCurrencyOptions, IsEmailOptions, IsFQDNOptions
} from "class-validator";
import {sanitize} from 'sw-class-sanitizer';
export * from 'class-validator';
export * from 'sw-class-sanitizer';
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


// Exports
export interface SanitationOptions {
    each?: boolean;
}

/**
 * Options used to pass to sanitation decorators.
 */
export interface SanitationOptions {
    /**
     * Specifies if sanity value is an array and each of its item must be sanitized.
     */
    each?: boolean;
}
/**
 * Decorator used to register custom sanitizer.
 */
export declare function SanitizerConstraint(): (object: Function) => void;
/**
 * Performs sanitation based on the given custom constraint.
 */
export declare function Sanitize(constraintClass: Function, annotationOptions?: SanitationOptions): (object: Object, propertyName: string) => void;
/**
 * Remove characters that appear in the blacklist. The characters are used in a RegExp and so you will need to
 * escape some chars, e.g @Blacklist('\\[\\]')
 */
export declare function Blacklist(chars: RegExp, annotationOptions?: SanitationOptions): (object: Object, propertyName: string) => void;
/**
 * Replace <, >, &, ', " and / with HTML entities.
 */
export declare function Escape(annotationOptions?: SanitationOptions): (object: Object, propertyName: string) => void;
/**
 * Trim characters from the left-side of the input.
 */
export declare function Ltrim(chars?: string[], annotationOptions?: SanitationOptions): (object: Object, propertyName: string) => void;
/**
 * Canonicalize an email address.
 */
export declare function NormalizeEmail(lowercase?: boolean, annotationOptions?: SanitationOptions): (object: Object, propertyName: string) => void;
/**
 * Trim characters from the right-side of the input.
 */
export declare function Rtrim(chars?: string[], annotationOptions?: SanitationOptions): (object: Object, propertyName: string) => void;
/**
 * Remove characters with a numerical value < 32 and 127, mostly control characters.
 * If keepNewLines is true, newline characters are preserved (\n and \r, hex 0xA and 0xD).
 * Unicode-safe in JavaScript.
 */
export declare function StripLow(keepNewLines?: boolean, annotationOptions?: SanitationOptions): (object: Object, propertyName: string) => void;
/**
 * Convert the input to a boolean.
 * Everything except for '0', 'false' and '' returns true. In strict mode only '1' and 'true' return true.
 */
export declare function ToBoolean(isStrict?: boolean, annotationOptions?: SanitationOptions): (object: Object, propertyName: string) => void;
/**
 * Convert the input to a date, or null if the input is not a date.
 */
export declare function ToDate(annotationOptions?: SanitationOptions): (object: Object, propertyName: string) => void;
/**
 * Convert the input to a float.
 */
export declare function ToFloat(annotationOptions?: SanitationOptions): (object: Object, propertyName: string) => void;
/**
 * Convert the input to an integer, or NaN if the input is not an integer.
 */
export declare function ToInt(radix?: number, annotationOptions?: SanitationOptions): (object: Object, propertyName: string) => void;
/**
 * Convert the input to a string.
 */
export declare function ToString(annotationOptions?: SanitationOptions): (object: Object, propertyName: string) => void;
/**
 * Trim characters (whitespace by default) from both sides of the input. You can specify chars that should be trimmed.
 */
export declare function Trim(chars?: string[], annotationOptions?: SanitationOptions): (object: Object, propertyName: string) => void;
/**
 * Remove characters that do not appear in the whitelist.
 * The characters are used in a RegExp and so you will need to escape some chars, e.g. whitelist(input, '\\[\\]').
 */
export declare function Whitelist(chars: RegExp, annotationOptions?: SanitationOptions): (object: Object, propertyName: string) => void;
/**
 * Indicates if nested object should be sanitized as well.
 */
export declare function SanitizeNested(annotationOptions?: SanitationOptions): (object: Object, propertyName: string) => void;

export declare function ValidatorConstraint(options?: {
    name?: string;
    async?: boolean;
}): (target: Function) => void;
/**
 * Performs validation based on the given custom validation class.
 * Validation class must be decorated with ValidatorConstraint decorator.
 */
export declare function Validate(constraintClass: Function, validationOptions?: ValidationOptions): Function;
export declare function Validate(constraintClass: Function, constraints?: any[], validationOptions?: ValidationOptions): Function;
/**
 * Objects / object arrays marked with this decorator will also be validated.
 */
export declare function ValidateNested(validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Objects / object arrays marked with this decorator will also be validated.
 */
export declare function ValidateIf(condition: (object: any, value: any) => boolean, validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if given value is defined (!== undefined, !== null).
 */
export declare function IsDefined(validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the value match ("===") the comparison.
 */
export declare function Equals(comparison: any, validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the value does not match ("!==") the comparison.
 */
export declare function NotEquals(comparison: any, validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if given value is empty (=== '', === null, === undefined).
 */
export declare function IsEmpty(validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if given value is not empty (!== '', !== null, !== undefined).
 */
export declare function IsNotEmpty(validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if value is in a array of allowed values.
 */
export declare function IsIn(values: any[], validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if value is not in a array of disallowed values.
 */
export declare function IsNotIn(values: any[], validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if a value is a boolean.
 */
export declare function IsBoolean(validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if a value is a date.
 */
export declare function IsDate(validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if a value is a number.
 */
export declare function IsNumber(validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the value is an integer number.
 */
export declare function IsInt(validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if a value is a string.
 */
export declare function IsString(validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if a value is an array.
 */
export declare function IsArray(validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the value is a number that's divisible by another.
 */
export declare function IsDivisibleBy(num: number, validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the value is a positive number.
 */
export declare function IsPositive(validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the value is a negative number.
 */
export declare function IsNegative(validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the given number is greater than given number.
 */
export declare function Min(min: number, validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the given number is less than given number.
 */
export declare function Max(max: number, validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the value is a date that's after the specified date.
 */
export declare function MinDate(date: Date, validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the value is a date that's before the specified date.
 */
export declare function MaxDate(date: Date, validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if a string is a boolean.
 */
export declare function IsBooleanString(validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the string is a date.
 */
export declare function IsDateString(validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the string is a number.
 */
export declare function IsNumberString(validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the string contains the seed.
 */
export declare function Contains(seed: string, validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the string does not contain the seed.
 */
export declare function NotContains(seed: string, validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the string contains only letters (a-zA-Z).
 */
export declare function IsAlpha(validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the string contains only letters and numbers.
 */
export declare function IsAlphanumeric(validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the string contains ASCII chars only.
 */
export declare function IsAscii(validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if a string is base64 encoded.
 */
export declare function IsBase64(validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the string's length (in bytes) falls in a range.
 */
export declare function IsByteLength(min: number, max?: number, validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the string is a credit card.
 */
export declare function IsCreditCard(validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the string is a valid currency amount.
 */
export declare function IsCurrency(options?: IsCurrencyOptions, validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the string is an email.
 */
export declare function IsEmail(options?: IsEmailOptions, validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the string is a fully qualified domain name (e.g. domain.com).
 */
export declare function IsFQDN(options?: IsFQDNOptions, validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the string contains any full-width chars.
 */
export declare function IsFullWidth(validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the string contains any half-width chars.
 */
export declare function IsHalfWidth(validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the string contains a mixture of full and half-width chars.
 */
export declare function IsVariableWidth(validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the string is a hexadecimal color.
 */
export declare function IsHexColor(validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the string is a hexadecimal number.
 */
export declare function IsHexadecimal(validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the string is an IP (version 4 or 6).
 */
export declare function IsIP(version?: "4" | "6", validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the string is an ISBN (version 10 or 13).
 */
export declare function IsISBN(version?: "10" | "13", validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the string is an ISIN (stock/security identifier).
 */
export declare function IsISIN(validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the string is a valid ISO 8601 date.
 */
export declare function IsISO8601(validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the string is valid JSON (note: uses JSON.parse).
 */
export declare function IsJSON(validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the string is lowercase.
 */
export declare function IsLowercase(validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the string is a mobile phone number (locale is one of ['zh-CN', 'zh-TW', 'en-ZA', 'en-AU', 'en-HK',
 * 'pt-PT', 'fr-FR', 'el-GR', 'en-GB', 'en-US', 'en-ZM', 'ru-RU', 'nb-NO', 'nn-NO', 'vi-VN', 'en-NZ']).
 */
export declare function IsMobilePhone(locale: string, validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the string is a valid hex-encoded representation of a MongoDB ObjectId.
 */
export declare function IsMongoId(validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the string contains one or more multibyte chars.
 */
export declare function IsMultibyte(validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the string contains any surrogate pairs chars.
 */
export declare function IsSurrogatePair(validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the string is an url.
 */
export declare function IsUrl(options?: IsURLOptions, validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the string is a UUID (version 3, 4 or 5).
 */
export declare function IsUUID(version?: "3" | "4" | "5", validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the string is uppercase.
 */
export declare function IsUppercase(validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the string's length falls in a range. Note: this function takes into account surrogate pairs.
 */
export declare function Length(min: number, max?: number, validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the string's length is not less than given number. Note: this function takes into account surrogate pairs.
 */
export declare function MinLength(min: number, validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if the string's length is not more than given number. Note: this function takes into account surrogate pairs.
 */
export declare function MaxLength(max: number, validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if string matches the pattern. Either matches('foo', /foo/i) or matches('foo', 'foo', 'i').
 */
export declare function Matches(pattern: RegExp, validationOptions?: ValidationOptions): Function;
export declare function Matches(pattern: RegExp, modifiers?: string, validationOptions?: ValidationOptions): Function;
/**
 * Checks if the string correctly represents a time in the format HH:MM
 */
export declare function IsMilitaryTime(validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if array contains all values from the given array of values.
 */
export declare function ArrayContains(values: any[], validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if array does not contain any of the given values.
 */
export declare function ArrayNotContains(values: any[], validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if given array is not empty.
 */
export declare function ArrayNotEmpty(validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if array's length is as minimal this number.
 */
export declare function ArrayMinSize(min: number, validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if array's length is as maximal this number.
 */
export declare function ArrayMaxSize(max: number, validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
/**
 * Checks if all array's values are unique. Comparison for objects is reference-based.
 */
export declare function ArrayUnique(validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;