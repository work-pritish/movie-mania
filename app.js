//LIBRARIES
var bodyParser    = require("body-parser"),
    mongoose      = require("mongoose"),
    request       = require("request"),
    flash         = require("connect-flash"),
    express       = require("express"),
    passport      = require("passport"),
    LocalStrategy = require("passport-local"),
    movieTrailer  = require("movie-trailer");

const app = express();

//MODELS
var Movie   = require("./models/Movie"),
    Comment = require("./models/Comment"),
    User    = require("./models/User");

//App Setup
mongoose.connect("mongodb://localhost/project", {useNewUrlParser: true});
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.use(flash());

//Passport Config
app.use(require("express-session")({
  secret: "I have a mango tree",
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(function(req, res, next){
  res.locals.currentUser = req.user;
  res.locals.error       = req.flash("error");
  res.locals.success     = req.flash("success");
  next();
});

//ROUTES---------------------------------
app.get("/", function(req, res){
  res.render("home");
});

//Adding Movie to User History
app.post("/addtohistory/:id/:movie", function(req, res){
  var movie = req.params.movie;
  var id = req.params.id;
  var added;
  User.findById(id, function(err, user){
    if(user.history.length == 0){
      added = true;
    }
    else{
      user.history.forEach(function(fmovie){ //fmovie = foundmovies
        if(fmovie.split("|")[0] == movie){
          added = false;
        }
      });
    }
    if(added == false){
      added = false;
    }
    else {
      added = true;
      var d = Date(Date.now());
      a = d.toString().split(" ");
      day = a[2] + " " + a[1] + " " + a[3];
      time = a[4];
      weekDay = a[0];
      date = day + "|" + weekDay + "|" + time;
      console.log(date);
      user.history.push(movie + "|" + date);
      user.save();
    }
  });

  req.flash("success", "Added to your watch history");
  res.redirect("/movie/" + movie);
});

app.get("/movie/:title", function(req, res){
  request("http://www.omdbapi.com/?apikey=34ae9d2e&t=" + req.params.title, function(error, response, body){
      if(!error && response.statusCode == 200){
        var movie = JSON.parse(body)
        movieTrailer(req.params.title, function (error, trailer){
          if(trailer)
            trailer = trailer.split("/")[3].split("=")[1]
          res.render('movie', {movie: movie, trailer: trailer});
        });
      }
    });
});

app.get("/tv-series/:title", function(req, res){
  res.redirect("/movie/" + req.params.title);
});

//History of Logged in User
app.get("/user/:id/history", isLoggedIn, function(req, res){
  User.findById(req.params.id, function(err, user){
    movies = user.history;
    res.render("history", {movies: movies});
  });
});

//Recommended Movies for you Page
app.get("/user/movies", isLoggedIn, function(req, res){
  var exec = require('child_process').exec, child;
  var mov;

User.findById(req.user._id, function(err, user){
  history = []
  for(i=0; i<user.history.length; i++){
    history.push(user.history[i].split("|")[0]);
  }
  mov = history;
  console.log('history', mov);

  for(i=0;i<mov.length;i++){
    mov[i] = mov[i].split(" ").join("_")
  }

  var out;
  console.log('sdf', mov);
  child = exec('python predict_user_movies.py ' + mov,
  function (error, stdout, stderr) {
    out = stdout;
    if (error !== null) {
      console.log('exec error: ' + error);
    }
    out = out.split(",");
    console.log("out", out);
    var recommend = [];
    recommend = out;
    console.log('recommend',recommend);
    res.render("recommended", {movies: recommend});
  });
});


});

//Search ROUTES
app.get("/search/:id", function(req, res){
  request("http://www.omdbapi.com/?apikey=34ae9d2e&s=" + req.params.id, function(error, response, body){
    var movies = JSON.parse(body)
    console.log(movies.Response);
      if(movies.Response == "False"){
        console.log('Response false h bhai');
        res.render("search", {id: req.params.id, movies: null});
      }
      else if(!error && response.statusCode == 200){
        res.render("search", {id: req.params.id, movies: movies});
  }});
});

app.post("/search", function(req, res){
  res.redirect("/search/" + req.body.search);
});


//Auth ROUTES
//Register
app.get("/register", function(req, res) {
  res.render("register");
});

app.post("/register", function(req, res){
  var d = Date(Date.now());
  a = d.toString().split(" ");
  day = a[2] + " " + a[1] + " " + a[3];
  time = a[4];
  joinedDate = day + "|" + a[0] + "|" + time;
  console.log(joinedDate);
  var newUser = new User({
    username: req.body.username,
    email: req.body.email,
    joined: joinedDate
  });
  if (req.body.repassword != req.body.password){
    req.flash("error", "Password and Re-entered Password must be same");
    res.redirect("register");
    return
  }
  User.register(newUser, req.body.password, function(err, user){
    if (err){
      req.flash("error", err.message);
      console.log(err);
      res.redirect("/register");
      return
    }
    passport.authenticate("local")(req, res, function(){
      req.flash("success", "Welcome to MovieMania " + user.username);
      res.redirect("/");
    });
  });
});

//Login
app.get("/login", function(req, res){
  res.render("login");
});

app.post("/login", passport.authenticate("local",
  {
    successRedirect: "/",
    failureRedirect: "/login",
    failureFlash: "Invalid Username or Password"
  }),function(req, res){
});

//Logout
app.get("/logout", function(req, res){
  req.logout();
  req.flash("success", "Logged you out!");
  res.redirect("back");
});

//User Profile
app.get("/user-profile", isLoggedIn, function(req, res){
  res.render("profile");
});

// Optional Links - One Touch Links
app.get("/tutorial", function(req, res){
  res.render("tutorial");
});

app.get("/about", function(req, res){
  res.render("about");
});

app.get("*", function(req, res){
  console.log("Error 404: Not found");
  res.send("Error 404: Not found. Click  to go back");
});

//Middleware
function isLoggedIn(req, res, next){
  if(req.isAuthenticated()){
    return next();
  }
  req.flash("error", "Please Login First!")
  res.redirect("/login");
}

app.listen(5000, function(){
  console.log("Server up on port 5000");
});
