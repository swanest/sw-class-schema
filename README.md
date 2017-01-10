# sw-decorators

Useful helper to construct and deconstruct objects over http requests.
This module re-exports validators from [Swanest' class-validator fork](https://github.com/swanest/class-validator) and sanitzers from [class-sanitizer](https://github.com/pleerock/class-sanitizer/)

## Install

`npm i sw-class-schema --save`

## Use-case

Suppose you have an `User` that is posting some `Posts`

```js

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
} from 'sw-class-schema';


class User extends Schema { 
            
    @Strict(false) //Additional parameters in JSON object won't throw an error
    
    @Min(12) @Max(12)
    age: number;
    
    @Contains("patrick")
    name: string;
    
    @ValidateIf(obj => obj.email != void 0) @IsEmail() //This is an optional field
    email: string;

    constructor() {
        super("age", "name", "email"); //Here all properties that need to be constructed/deconstructed
    }
            
}


class Post extends Schema {

    @Strict(true) //Strict mode
    
    @IsDefined() @ValidateNested() //Never forget to put @IsDefined() if you use @ValidateNested()
    user: User;
    
    @Length(5, 20)
    title: string;
    
    @Contains("hello") @Length(10, 200)
    text: string;
    
    @IsDatable() //This means either an ISO string date or a Date object
    @ToDate() //When an object is stringified, Date objects become ISO strings, so to reconstruct, we use ToDate formatter 
    date: Date;
    
    constructor() { //Never forget it !
        super({user: User}, "title", "text", "date");
    }
    
 }

```


## toSchema()

This sync method returns an object and recursively schematize inner objects.

```js
let post = new Post();
post.title = "welcome";
post.user = new User();
post.toSchema();
```

## fromSchema()

This async static method returns a promise of instance.

```js

let post = await Post.fromSchema<Post>({title:"hello"}); //This will throw an error

```