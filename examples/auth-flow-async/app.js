import React, { findDOMNode } from 'react';
import { Router, Route, Link, Navigation } from 'react-router';
import HashHistory from 'react-router/lib/HashHistory';


//pretend server
function loginRequest(email, pass, cb) {
  setTimeout(() => {
    if (email === 'joe@example.com' && pass === 'password1') {
      cb({
        authenticated: true,
        token: {
          key: Math.random().toString(36).substring(7)
        }
      });
    } else {
      cb({authenticated: false});
    }
  }, 0);
}

function getUserDataRequest(token, cb) {
  setTimeout(() => {
    //assume tokens do not expire
    if(token.key){
      cb({
        name: 'Joe Bloggs',
        creditcard: '1234567890'
      })
    }else{
      cb({
        error: 'token expired'
      })
    }
  }, 0);
}

// next path store, default to dashboard
var nextPathStore = '/dashboard';

// auth module
var auth = (function(){
  var isLoggedIn = false,  user = null, self = {
    //login with basic auth (email and password) to retrieve a token
    login: function (email, pass, cb) {
      loginRequest(email, pass, (res) => {
        if (res.authenticated) {
          // if login accepted then use the returned token to get user data
          self.getUserData(res.token);
        } else {
          self.logout();
          cb (isLoggedIn);
        }
      });
    },
    getUserData: function(token){
      getUserDataRequest(token, (res) => {
        if(res.error){
          self.logout();
        }else{
          user = res;
          localStorage.token = token;
          isLoggedIn = true;
        }
        self.onChange(isLoggedIn);
      })
    },
    logout: function () {
      isLoggedIn = false;
      user = null;
      delete localStorage.token;
      self.onChange(isLoggedIn);
    },
    isLoggedIn: function () {
      return isLoggedIn;
    },
    getUser: function (){
      return user;
    },
    autoLogin: function (){
      console.log('auth auto-login at start with localStorage token:', localStorage.token);
      if (localStorage.token) {
        self.getUserData(localStorage.token);
      }
    },
    //binds to listener function in App component
    onChange: function () {}
  };
  return self;
})();

//authenticated component wrapper hook
var requireAuth =  function(nextState, transition) {
  if (!auth.isLoggedIn()){
    //store the path
    nextPathStore = nextState.location.pathname
    //redirect to the shim
    console.log('in requireAuth hook, redirecting to shim with nextPathStore:', nextPathStore);
    transition.to('/shim');
  }
}

//App component
var App = React.createClass({
  statics: {
    onEnter: function(nextState, transition) {
      if(nextState.location.pathname === '/'){
        //always attempt to go to the dashboard
        transition.to('/dashboard');
      }
    }
  },
  contextTypes: {
    router: React.PropTypes.object.isRequired
  },
  getInitialState() {
    return {
      loggedIn: auth.isLoggedIn()
    };
  },
  //auth login/logout module listener
  authListener(loggedIn) {
    this.setState({
      loggedIn: loggedIn
    });
    //re-direct post login or logout
    console.log('in App authListener, relocating to', nextPathStore);
    if(loggedIn){
      this.context.router.transitionTo(nextPathStore);
    }else{
      this.context.router.transitionTo('/login');
    }
  },
  componentWillMount() {
    //bind
    auth.onChange = this.authListener;
  },
  render() {
    return (
      <div>
        <ul>
          <li>
            {this.state.loggedIn ? (
              <Link to="/logout">Log out</Link>
            ) : (
              <Link to="/login">Sign in</Link>
            )}
          </li>
          <li><Link to="/about">About</Link></li>
          <li><Link to="/dashboard">Dashboard</Link> (authenticated)</li>
        </ul>
        {this.props.children}
      </div>
    );
  }
});

//dashboard component requires authentication
var Dashboard = React.createClass({
  render() {
    var user = auth.getUser();
    return (
      <div>
        <h1>Dashboard</h1>
        <p>Hi {user.name}. You made it!</p>
        <p>Your credit card is {user.creditcard}</p>
      </div>
    );
  }
});

var Login = React.createClass({
  mixins: [ Navigation ],
  getInitialState() {
    return {
      error: false
    };
  },
  handleSubmit(event) {
    event.preventDefault();
    var email = findDOMNode(this.refs.email).value;
    var pass = findDOMNode(this.refs.pass).value;
    //in Flux this should just kick off an action
    auth.login(email, pass, (loggedIn) => {
      if (!loggedIn)
        return this.setState({ error: true });
    });
  },
  render() {
    return (
      <form onSubmit={this.handleSubmit}>
        <label><input ref="email" placeholder="email" defaultValue="joe@example.com"/></label>
        <label><input ref="pass" placeholder="password"/></label> (hint: password1)<br/>
        <button type="submit">login</button>
        {this.state.error && (
          <p>Bad login information</p>
        )}
      </form>
    );
  }
});

// shim component for async stuff when logging in
var Shim = React.createClass({
  contextTypes: {
    router: React.PropTypes.object.isRequired
  },
  //main function
  transitionNext(){
    var router = this.context.router;
    if (auth.isLoggedIn()){
      //can wait here for some reason
      setTimeout(() => {
        console.log('redirecting from shim to', nextPathStore);
        router.transitionTo(nextPathStore);
      }, 1000);
    }else{
      router.transitionTo('/login');
    }
  },
  // redirect when using the shim for the first time
  componentWillMount() {
    this.transitionNext();
  },
  // redirect elsewhere in component lifecycle - e.g. when logging out and in again
  shouldComponentUpdate(){
    this.transitionNext();
    return false;
  },
  render() {
    return <div>Waiting...</div>;
  }
});

var Logout = React.createClass({
  componentDidMount(){
    auth.logout();
  },
  render() {
    return <p>You are now logged out</p>;
  }
});

//do this before declaring the routes
auth.autoLogin();

React.render((
  <Router history={new HashHistory({ queryKey: true })}>
    <Route path="/" component={App} onEnter={App.onEnter}>
      <Route path="login" component={Login}/>
      <Route path="logout" component={Logout}/>
      <Route path="shim" component={Shim}/>
      <Route path="dashboard" component={Dashboard} onEnter={requireAuth}/>
    </Route>
  </Router>
), document.getElementById('example'));
