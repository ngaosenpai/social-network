import React, { useState, useEffect, } from 'react';
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Redirect,
  Link,
  useRouteMatch,
  useParams,
  useHistory,
} from "react-router-dom";
import { useSelector, useDispatch } from 'react-redux'

import {KEEP_SESSION} from "./redux/session/sessionActionType"

import NavBar from "./components/NavBar/NavBar"
import Home from "./components/Home/Home"
import Search from "./components/Search/Search"
import Login from "./components/Login/Login"
import Register from "./components/Register/Register"
import LeftNavBar from "./components/LeftNavBar/LeftNavBar"

import './App.scss';

export default function App() {
	
	const { accessToken, user } = useSelector(state => state.session)
	const store = useSelector(state => state)
	const dispatch = useDispatch();
	const history = useHistory();

	const isLogin = () => {
		return (accessToken !== null && user !== null)
	}

	useEffect(() => {

		dispatch({type : KEEP_SESSION})

	}, [])

	useEffect(() => {
		console.log('re-render')
		console.log(accessToken)
		console.log(user)
		console.log(store)
	}, [accessToken, user])

	return (
		<Router>
			<div>
				{
					isLogin()? <Redirect to="/" /> : <Redirect to="/login" />
				}
				{
					isLogin()? <NavBar/> : null
				}
				<Switch>
					<Route exact path="/login">
						<Login />
					</Route>
					<Route path="/search">
						<Search />
					</Route>
					<Route path="/groups">
						<LeftNavBar />
					</Route>
					<Route path="/">
						<Home />
					</Route>
				</Switch>
			</div>
		</Router>
	);
}