"use strict";
var V = require("sw-class-validator");
var S = require("class-sanitizer");
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
var Properties;
(function (Properties) {
    Properties.Sanitizers = S;
    Properties.Validators = V;
})(Properties = exports.Properties || (exports.Properties = {}));
var Classes;
(function (Classes) {
    function ToAndFromSchema() {
        return function (Target) {
            console.log("ok", Target);
            Target.prototype.test = function () {
            };
        };
    }
    Classes.ToAndFromSchema = ToAndFromSchema;
})(Classes = exports.Classes || (exports.Classes = {}));
