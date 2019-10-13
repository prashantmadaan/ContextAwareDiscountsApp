'use strict';

var express = require('express');
var braintree = require('braintree');
var router = express.Router(); // eslint-disable-line new-cap
var gateway = require('../lib/gateway');
var Task = require('../models/userProfileAPIModels');
var mongoose = require('mongoose');
var Login = mongoose.model('login');
var Users = mongoose.model('user');
var products = mongoose.model('products');

const jwt = require('jsonwebtoken');
var braintree_id;


var TRANSACTION_SUCCESS_STATUSES = [
  braintree.Transaction.Status.Authorizing,
  braintree.Transaction.Status.Authorized,
  braintree.Transaction.Status.Settled,
  braintree.Transaction.Status.Settling,
  braintree.Transaction.Status.SettlementConfirmed,
  braintree.Transaction.Status.SettlementPending,
  braintree.Transaction.Status.SubmittedForSettlement
];

function formatErrors(errors) {
    var formattedErrors = '';

    for (var i in errors) { // eslint-disable-line no-inner-declarations, vars-on-top
        if (errors.hasOwnProperty(i)) {
            formattedErrors += 'Error: ' + errors[i].code + ': ' + errors[i].message + '\n';
        }
    }

    return formattedErrors;
}

function createResultObject(transaction) {
    var result;
    var status = transaction.status;

    if (TRANSACTION_SUCCESS_STATUSES.indexOf(status) !== -1) {
        result = {
            header: 'Sweet Success!',
            icon: 'success',
            message: 'Your test transaction has been successfully processed. See the Braintree API response and try again.'
        };
    } else {
        result = {
            header: 'Transaction Failed',
            icon: 'fail',
            message: 'Your test transaction has a status of ' + status + '. See the Braintree API response and try again.'
        };
    }

    return result;
}

router.get('/', function (req, res) {
    res.redirect('/checkouts/new');
});

//This function will create token for client before payent

router.get('/checkouts/new', function (req, res) {

    console.log("inside validate function");

    console.log(req.headers);

    const bearerHeader = req.headers['authorization'];

    if (typeof bearerHeader !== "undefined") {
        const bearer = bearerHeader.split(" ");
        const bearer_token = bearer[1];
        req.token = bearer_token;
        console.log("inside bearer");

        jwt.verify(req.token, 'secretkey', (err, authData) => {
            if (err) {
                res.send(403);
                console.log("forbidden from validate");
            } else {
                gateway.clientToken.generate({
                    customerId: authData.braintree_id
                }, function (err, response) {
                    // res.render('checkouts/new', {clientToken: response.clientToken, messages: req.flash('error')});
                    console.log("hit the checkouts new");
                    res.send(JSON.stringify(response)); // Instead of render a view, we just return an json object for the API
                });
            }
        });
    } else {
        console.log("Failed here");
        res.sendStatus(403);
    }
});

router.get('/checkouts/:id', function (req, res) {
    var result;
    var transactionId = req.params.id;

    gateway.transaction.find(transactionId, function (err, transaction) {
        result = createResultObject(transaction);
        res.render('checkouts/show', {
            transaction: transaction,
            result: result
        });
    });
});

// This function wil process checkout
router.post('/checkouts', function (req, res) {
    var transactionErrors;
    var amount = req.body.amount; // In production you should not take amounts directly from clients
    var nonce = req.body.payment_method_nonce;

    console.log("amount in gateway", amount);

    const bearerHeader = req.headers['authorization'];
    console.log("bearerHeader: " + bearerHeader);

    if (typeof bearerHeader !== "undefined") {
        const bearer = bearerHeader.split(" ");
        const bearer_token = bearer[1];
        req.token = bearer_token;
        console.log("Inside Bearer");

        jwt.verify(req.token, 'secretkey', (err, authData) => {
            if (err) {
                res.send(403);
                console.log("forbidden from validate");
            } else {
                gateway.transaction.sale({
                    amount: amount,
                    paymentMethodNonce: nonce,
                    options: {
                        submitForSettlement: true
                    }
                }, function (err, result) {
                    if (result.success || result.transaction) {
                        // res.redirect('checkouts/' + result.transaction.id);
                        res.send(result);
                    } else {
                        console.log("error in checkouts", err);
                        transactionErrors = result.errors.deepErrors();
                        //  req.flash('error', {msg: formatErrors(transactionErrors)});
                        // res.redirect('checkouts/new');
                        res.send(formatErrors(transactionErrors));
                    }
                });
            }
        })

    } else {
        console.log("Bearer header undefined in else");
        res.send("Bearer not correct");
    }
});

router.post('/signup', function (req, res) {
    console.log("Reached Inside Signup");
    if (!req.body.email || !req.body.password) {
        res.status(400).send({
            message: "Invalid parameters"
        });
    }
    console.log("Reached checking params");

    var email_req = req.body.email;
    var password_req = req.body.password;
    Login.find({
        _id: email_req
    }, function (error, comments) {
        console.log("Error================", error);
        console.log("========comments==========", comments);

        if (error) {
            res.status(400).send({
                message: "Error occured while fetching from user schema"
            });
        }
        //   console.log("Reached Inside Signup");
        if (comments.length == 0) {
            var first_name_req = req.body.first_name;
            var last_name_req = req.body.last_name;
            var loginUser = {
                "_id": email_req,
                "password": password_req,
            }
            var login_task = new Login(loginUser);
            login_task.save(function (err, loginUser) {
                if (err) {
                    // res.send(err);
                }
            });


            gateway.customer.create({
                firstName: first_name_req,
                lastName: last_name_req,
                email: email_req
            }, function (err, result) {
                if (err) {
                    console.log(err);
                }
                result.success;
                // true
                console.log("success");

                braintree_id = result.customer.id;
                // e.g. 494019
                console.log("customer id", result.customer.id);
                var userObj = {
                    _id: email_req,
                    first_name: first_name_req,
                    last_name: last_name_req,
                    braintree_id: braintree_id
                }
                console.log(userObj);

                var users_task = new Users(userObj);
                users_task.save(function (err, userObj) {
                    if (err) {
                        //res.send(err);
                    }
                    res.send("success");
                });

            });

        } else {
            res.send("User exists");
        }



    });

});

router.post('/signin', function (req, res) {
    var email_req = req.body.email;
    var passwowrd = req.body.password;
    Login.find({
        _id: email_req
    }, function (error, comments) {
        const response = {};
        var tok = 0;
        // var user_brain_id;
        if (comments.length) {
            if (comments[0].password === req.body.password) {
                Users.find({
                    _id: email_req
                }, function (error, comments) {
                    var response = {};
                    console.log("inside find", );
                    if (comments.length) {
                        console.log("User Found");
                        console.log(comments[0]);
                        var user = comments[0];
                        var user_brain_id = user.braintree_id;
                        console.log(user_brain_id);
                        jwt.sign({
                            email: email_req,
                            braintree_id: user_brain_id
                        }, "secretkey", (err, token) => {
                            response.status = "Success";
                            response.message = "User Sucessfully logged In";
                            response.token = token;
                            response.first_name = user.first_name;
                            console.log(response);
                            res.send(response);
                        });

                    }
                });
            } else {
                response.status = "Failure";
                response.message = "password not correct";
                res.send(response);
            }
        } else {
            response.status = "Failure";
            response.message = "user not found";
            res.send(response)
        }
    });
});

router.get('/userprofile/', function (req, res) {
    console.log("inside fetch user profile");
    console.log("got token back from the android", req.token);

    console.log("req header", req.headers);
    console.log("req header", req.headers['authorization']);

    const bearerHeader = req.headers['authorization'];

    if (typeof bearerHeader !== "undefined") {
        const bearer = bearerHeader.split(" ");
        const bearer_token = bearer[1];
        req.token = bearer_token;
        //  req.token= bearerHeader;
        console.log("inside bearer");

        console.log(req.token)
        jwt.verify(req.token, 'secretkey', (err, authData) => {
            if (err) {
                res.send(403);
                console.log("forbidden from validate");
            } else {
                //  res.send("validated");
                console.log(authData);
                console.log(authData.email);
                getuserProfile(authData.email, req, res)
                //console.log(data);

            }
        });
    } else {
        res.sendStatus(403);
    }
});

router.put('/userprofile/', function (req, res) {
    console.log("update user profile");

    console.log("inside validate function");

    const bearerHeader = req.headers['authorization'];

    if (typeof bearerHeader !== "undefined") {
        const bearer = bearerHeader.split(" ");
        const bearer_token = bearer[1];
        req.token = bearer_token;
        console.log("inside bearer");

        jwt.verify(req.token, 'secretkey', (err, authData) => {
            if (err) {
                res.send(403);
                console.log("forbidden from validate");
            } else {
                //  res.send("validated");
                console.log(req.body);
                updateuserProfile(authData.email, req, res)
                //console.log(data);

            }
        });
    } else {
        res.sendStatus(403);
    }
});



function getuserProfile(email, req, res) {
    Users.find({
        _id: email
    }, function (error, comments) {
        var response = {};
        console.log("inside find", );
        if (comments.length) {
            console.log("User Found");
            console.log(comments[0]);
            var user = comments[0];
            response.status = 200;
            response.data = user;
        } else {
            response.status = 502;
            response.message = "User Not found";
        }
        res.send(response);
    });
}



function updateuserProfile(user, req, res) {
    console.log(user["email"]);
    console.log(user.email);
    Users.findOneAndUpdate({
        _id: user.email
    }, {
        first_name: user.first_name,
        last_name: user.last_name,
        age: user.age,
        weight: user.weight,
        address: user.address
    }, function (error, comments) {
        //     var response = {};
        //      if(comments.length){
        //        console.log("User Found");
        //        console.log(comments[0]);
        //       var user=comments[0];
        //       response.status=200;
        //       response.data=user;
        //  }else{
        //   response.status=502;
        //   response.message="User Not found";
        // }
        //   res.send(response);
        if (error) {
            var response = {};
            response.status = 402;
            response.message = "Not  Updated";
            res.send(response);
        }
        var response = {};
        response.status = 200;
        response.message = "User Updated Successfully";
        res.send(response);

    });
}

router.get('/contextawareproducts', function (req, res) {
    var response = {};
    //var productList={};
    const bearerHeader = req.headers['authorization'];
    console.log("bearerHeader: " + bearerHeader);

    if (typeof bearerHeader !== "undefined") {
        const bearer = bearerHeader.split(" ");
        const bearer_token = bearer[1];
        req.token = bearer_token;
        console.log("Inside Bearer");

        jwt.verify(req.token, 'secretkey', (err, authData) => {
            if (err) {
                res.send(403);
                console.log("forbidden from validate");
            } else {
                var major = req.headers['major'];
                var minor = req.headers['minor'];
                console.log("major:minor",major+" :",minor)

                if (major + ":" + minor == "30462:43265") {
                    console.log("Inside firs majrr")
                    products.find({
                            region: "grocery"
                        }, function (err, items) {
                            //console.log(items);
                            // productList.push(items);

                            if (items.length > 0) {
                                response.status = 200;
                                response.message = "products sent successfully";
                                response.data = items;
                                res.send(response);

                            } else {
                                response.status = 402;
                                response.message = "product list empty";
                                res.send(response);
                            }
                        });
                                  }
                    else if(major + ":" + minor == "26535:44799") {
                        products.find({
                                region: "produce"
                            }, function (err, items) {
                                //console.log(items);
                                // productList.push(items);

                                if (items.length > 0) {
                                    response.status = 200;
                                    response.message = "products sent successfully";
                                    response.data = items;
                                    res.send(response);

                                } else {
                                    response.status = 402;
                                    response.message = "product list empty";
                                    res.send(response);
                                }
                            });

                        }
                        else if(major + ":" + minor == "15212:31506") {

                            products.find({
                                    region: "lifestyle"
                                }, function (err, items) {
                                    //console.log(items);
                                    // productList.push(items);

                                    if (items.length > 0) {
                                        response.status = 200;
                                        response.message = "products sent successfully";
                                        response.data = items;
                                        res.send(response);

                                    } else {
                                        response.status = 402;
                                        response.message = "product list empty";
                                        res.send(response);
                                    }
                                });
                            }
                            else {
                                products.find({}, function (err, items) {
                                        //console.log(items);
                                        // productList.push(items);

                                        if (items.length > 0) {
                                            response.status = 200;
                                            response.message = "products sent successfully";
                                            response.data = items;
                                            res.send(response);

                                        } else {
                                            response.status = 402;
                                            response.message = "product list empty";
                                            res.send(response);
                                        }
                                    });
                                }
                            }
                        }
                );
    } else {
        console.log("Failed here");
        res.sendStatus(403);
    }
});


router.get('/products', function (req, res) {
    var response = {};
    //var productList={};
    const bearerHeader = req.headers['authorization'];
    console.log("bearerHeader: " + bearerHeader);

    if (typeof bearerHeader !== "undefined") {
        const bearer = bearerHeader.split(" ");
        const bearer_token = bearer[1];
        req.token = bearer_token;
        console.log("Inside Bearer");

        jwt.verify(req.token, 'secretkey', (err, authData) => {
            if (err) {
                res.send(403);
                console.log("forbidden from validate");
            } else {
                products.find({}, function (err, items) {
                    //console.log(items);
                    // productList.push(items);

                    if (items.length > 0) {
                        response.status = 200;
                        response.message = "products sent successfully";
                        response.data = items;
                        res.send(response);

                    } else {
                        response.status = 402;
                        response.message = "product list empty";
                        res.send(response);
                    }
                });
            }
        })
    } else {
        console.log("Failed here");
        res.sendStatus(403);
    }
});


module.exports = router
