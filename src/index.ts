import * as V from 'sw-class-validator';
import * as S from 'class-sanitizer';

// let VN = V.ValidateNested.bind(V);
//
// (V as any).ValidateNested = function (validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void {
//     let performer = VN(validationOptions);
//     return function (object: Object, propertyName: string): void {
//         console.log(arguments[0].user);
//
//         if ((object as any)[propertyName] != void 0) {
//             performer(object, propertyName);
//         }
//         else {
//             V.IsDefined()(object, propertyName);
//         }
//     };
// };


export module Properties {
    export var Sanitizers = S;
    export var Validators = V;
}


export class JSONifiable {
    toJSON(): void {

    }
    fromJSON(): void {

    }
}


export module Classes {

    export function ToAndFromSchema<TFunction extends Function>(Target: TFunction): void {
        let newConstructor = function () {
            Target.apply(this);
        };

        newConstructor.prototype = Object.create(Target.prototype);
        newConstructor.prototype.constructor = JSONifiable;
        newConstructor.prototype.fromJSON = function () {
        };
        newConstructor.prototype.toJSON = function () {
        };

        /*return <any> newConstructor;*/
    };
}



