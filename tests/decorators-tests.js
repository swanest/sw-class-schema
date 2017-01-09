"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var sw_logger_1 = require("sw-logger");
var Decorators = require("../src");
var PV = Decorators.Properties.Validators;
var tracer = new sw_logger_1.Logger();
describe("Decorators", function () {
    it("validates", function (done) {
        this.timeout(2000000);
        var User = (function () {
            function User() {
            }
            return User;
        }());
        __decorate([
            PV.Min(12), PV.Max(12)
        ], User.prototype, "age", void 0);
        __decorate([
            PV.Contains("patrick")
        ], User.prototype, "name", void 0);
        var Post = (function () {
            function Post() {
            }
            return Post;
        }());
        __decorate([
            PV.IsDefined(), PV.ValidateNested()
        ], Post.prototype, "user", void 0);
        __decorate([
            PV.Length(5, 20)
        ], Post.prototype, "title", void 0);
        __decorate([
            PV.Contains("hello"),
            PV.Length(10, 200)
        ], Post.prototype, "text", void 0);
        __decorate([
            PV.IsDate()
        ], Post.prototype, "date", void 0);
        __decorate([
            PV.ValidateIf(function (obj) { return obj.email != void 0; }), PV.IsEmail()
        ], Post.prototype, "email", void 0);
        __decorate([
            PV.IsFQDN()
        ], Post.prototype, "site", void 0);
        var ob = new Post();
        ob.title = "Hello"; // should not pass
        ob.text = "hello this is a great post about hell world"; // should not pass
        ob.email = "l.cyril@google.com"; // should not pass
        ob.site = "www.google.com"; // should not pass
        ob.date = new Date();
        ob.user = new User();
        //PS.sanitize(ob);
        //tracer.log(ob);
        PV.validate(ob, { validationError: { target: false } }).then(function (errors) {
            if (errors.length > 0) {
                tracer.log("validation failed. errors: ", errors);
            }
            else {
                tracer.log("validation succeed");
            }
        }).catch(function (err) {
            tracer.error("the errors", err);
        });
    });
});
