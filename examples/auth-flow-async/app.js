import React, { findDOMNode } from 'react';
import { Router, Route, Link } from 'react-router';
import HashHistory from 'react-router/lib/HashHistory';


//pretend server
function loginRequest(email, pass, cb) {
  setTimeout(() => {
    if (email === 'joe@example.com' && pass === 'password1') {
      cb({
        authenticated: true,
        token: Math.random().toString(36).substring(7)
      });
    } else {
      cb({authenticated: false});
    }
  }, 200);
}

function getUserDataRequest(token, cb) {
  setTimeout(() => {
    //assume tokens do not expire for test purposes
    if(token){
      cb({
        name: 'Joe Bloggs',
        creditcard: '1234567890'
      })
    }
  }, 500);
}

// next path store, default to dashboard
var nextPathStore = '/dashboard';

//token name - NB token value is stored as a string too
var tokenName = 'jwt_test'

// auth module
var auth = (function(){
  var loggedIn = false, asyncLoggingIn = false,  user = null, self = {
    login: function (email, pass, cb) {
      asyncLoggingIn = true;
      loginRequest(email, pass, (res) => {
        if (res.authenticated) {
          self.getUserData(res.token);
        } else {
          self.logout();
          cb (loggedIn);
        }
      });
    },
    getUserData: function(token){
      asyncLoggingIn = true;
      getUserDataRequest(token, (res) => {
        if(res.error){
          self.logout();
        }else{
          user = res;
          localStorage.setItem(tokenName, token);
          loggedIn = true;
          asyncLoggingIn = false;
          self.onChange(loggedIn);
        }
      })
    },
    logout: function () {
      asyncLoggingIn = false;
      loggedIn = false;
      user = null;
      localStorage.setItem(tokenName, '');
      self.onChange(loggedIn);
    },
    isLoggedIn: function () {
      return loggedIn;
    },
    isAsyncLoggingIn: function () {
      return asyncLoggingIn;
    },
    getUser: function (){
      return user;
    },
    autoLogin: function (){
      var token = localStorage.getItem(tokenName);
      if (token) {
        self.getUserData(token);
      }
    },
    //binds to listener in App component
    onChange: function () {}
  };
  return self;
})();

//authenticated component hook
var requireAuth =  function(nextState, transition) {
  if (!auth.isLoggedIn()){
    //store the path
    nextPathStore = nextState.location.pathname
    //redirect to the shim
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
    if(loggedIn){
      console.log('in App authListener, relocating to', nextPathStore);
      this.context.router.transitionTo(nextPathStore);
    }else{
      console.log('in App authListener, relocating to login');
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
  contextTypes: {
    router: React.PropTypes.object.isRequired
  },
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

// YOU SHOULD ONLY GO HERE WHEN NOT LOGGED IN
var Shim = React.createClass({
  contextTypes: {
    router: React.PropTypes.object.isRequired
  },

  transitionCheck(){
    var router = this.context.router;

    //if not waiting for some async login outcome then re-direct to login
    if (!auth.isAsyncLoggingIn()){
      console.log('in shim redirecting to login');
      router.transitionTo('/login');
    }

    //if you've gone here by accident
    if(auth.isLoggedIn()){
      console.log('in shim by accident, redirecting to', nextPathStore);
      router.transitionTo(nextPathStore);
    }
  },

  componentWillMount() {
    this.transitionCheck();
  },

  render() {
    return <div>waiting...</div>;
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

var About = React.createClass({
  render() {
    return <h1>About</h1>;
  }
});

auth.autoLogin();

React.render((
  <Router history={new HashHistory({ queryKey: true })}>
    <Route path="/" component={App} onEnter={App.onEnter}>
      <Route path="login" component={Login}/>
      <Route path="logout" component={Logout}/>
      <Route path="shim" component={Shim}/>
      <Route path="about" component={About}/>
      <Route path="dashboard" component={Dashboard} onEnter={requireAuth}/>
    </Route>
  </Router>
), document.getElementById('example'));
