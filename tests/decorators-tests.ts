import {expect} from "chai";
import * as _ from "lodash";
import * as When from "when";
import {Logger, CustomError} from 'sw-logger';
import * as Decorators  from '../src';
import PV = Decorators.Properties.Validators;
import PS = Decorators.Properties.Sanitizers;
import ToAndFromSchema = Decorators.Classes.ToAndFromSchema;

let tracer = new Logger();

/*

    sw-common


 */
describe("Decorators", () => {

    it("validates", function (done) {

        this.timeout(2000000);

        class User {
            @PV.Min(12) @PV.Max(12)
            age: number;
            @PV.Contains("patrick")
            name: string;
        }

        @ToAndFromSchema
        class Post extends User{
            @PV.IsDefined() @PV.ValidateNested()
            private user: User;

            @PV.Length(5, 20)
            title: string;

            @PV.Contains("hello")
            @PV.Length(10, 200)
            text: string;

            @PV.IsDate()
            date: Date;

            @PV.ValidateIf(obj => obj.email != void 0) @PV.IsEmail()
            email: string;

            @PV.IsFQDN()
            site: string;
        }

        let p = new Post();
        p.to
        let ob: any = new Post();



        ob.title = "Hello"; // should not pass
        ob.text = "hello this is a great post about hell world"; // should not pass
        ob.email = "l.cyril@google.com"; // should not pass
        ob.site = "www.google.com"; // should not pass
        ob.date = new Date();
        ob.user = new User();


        //PS.sanitize(ob);

        //tracer.log(ob);

        PV.validate(ob, {validationError: {target: false}}).then(errors => { // errors is an array of validation errors
            if (errors.length > 0) {
                tracer.log("validation failed. errors: ", errors);
            } else {
                tracer.log("validation succeed");
            }
        }).catch((err) => {
            tracer.error("the errors", err);
        });

    });


});