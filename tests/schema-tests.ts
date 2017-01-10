import {expect} from "chai";
import * as _ from "lodash";
import {Logger, CustomError} from 'sw-logger';
import {
    Schema,
    Min,
    Max,
    Contains,
    ValidateNested,
    IsDefined,
    IsDate,
    Length,
    ValidateIf,
    IsEmail,
    IsFQDN, Strict, IsDatable, ToDate
} from '../src/index';

import * as SourceMap from 'source-map-support';

SourceMap.install({
    handleUncaughtExceptions: true
});

let tracer = new Logger();

describe("Schemas", () => {

    it("fromSchema() should fail", async function () {
        this.timeout(2000000);
        class User extends Schema {
            @Strict(false)
            @Min(12) @Max(12)
            age: number;
            @Contains("patrick")
            name: string;

            constructor() {
                super("age", "name");
            }
        }
        class Post extends Schema {
            @Strict(true)
            @IsDefined() @ValidateNested()
            user: User;
            @Length(5, 20)
            title: string;
            @Contains("hello") @Length(10, 200)
            text: string;
            @IsDatable()
            @ToDate()
            date: Date;
            @ValidateIf(obj => obj.email != void 0) @IsEmail()
            email: string;
            @IsFQDN()
            site: string;

            constructor() {
                super({user: User}, "title", "text", "date", "email", "site");
            }
        }
        let req = {
            title: "Hello",
            text: "hello this blabla",
            email: "okok@okok.com",
            site: "www.okok.com",
            date: "2015-05-05T44:56:43.854Z",
            moremore: 1,
            user: {
                camembert: 3,
                name: "patric",
                age: 12
            }
        };
        try {
            let b: Post = await Post.fromSchema<Post>(req);
            throw new Error("not expected to pass");
        } catch (e) {
            expect(e.info.validationErrors).to.have.lengthOf(3);
        }
    });


    it("fromSchema() should pass", async function () {
        this.timeout(2000000);
        class User extends Schema {
            @Strict(false)
            @Min(12) @Max(12)
            age: number;
            @Contains("patrick")
            name: string;

            constructor() {
                super("age", "name");
            }
        }
        class Post extends Schema {
            @Strict(true)
            @IsDefined() @ValidateNested()
            user: User;
            @Length(5, 20)
            title: string;
            @Contains("hello") @Length(10, 200)
            text: string;
            @IsDatable()
            @ToDate()
            date: Date;
            @ValidateIf(obj => obj.email != void 0) @IsEmail()
            email: string;
            @IsFQDN()
            site: string;

            constructor() {
                super({user: User}, "title", "text", "date", "email", "site");
            }
        }
        let req = {
            title: "Hello",
            text: "hello this blabla",
            email: "okok@okok.com",
            site: "www.okok.com",
            date: "2015-05-05T14:56:43.854Z",
            user: {
                camembert: 3,
                name: "patrick",
                age: 12
            }
        };
        let b: Post = await Post.fromSchema<Post>(req);
        expect(b).to.be.instanceof(Post);
    });


    it("toSchema() should pass", async function () {
        this.timeout(2000000);
        class User extends Schema {
            @Strict(false)
            @Min(12) @Max(12)
            age: number;
            @Contains("patrick")
            name: string;

            constructor() {
                super("age", "name");
            }
        }
        class Post extends Schema {
            @Strict(true)
            @IsDefined() @ValidateNested()
            user: User;
            @Length(5, 20)
            title: string;
            @Contains("hello") @Length(10, 200)
            text: string;
            @IsDatable()
            @ToDate()
            date: Date;
            @ValidateIf(obj => obj.email != void 0) @IsEmail()
            email: string;
            @IsFQDN()
            site: string;

            constructor() {
                super({user: User}, "title", "text", "date", "email", "site");
            }
        }
        let req = {
            title: "Hello",
            text: "hello this blabla",
            email: "okok@okok.com",
            site: "www.okok.com",
            date: "2015-05-05T14:56:43.854Z",
            user: {
                camembert: 3,
                name: "patrick",
                age: 12
            }
        };
        let b: Post = await Post.fromSchema<Post>(req);
        delete req.user.camembert;
        expect(b.toSchema()).to.have.all.keys(_.keys(req));
    });


});