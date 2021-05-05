import React, { useState, useEffect } from 'react';
import { List, Badge, Divider } from "antd"
import axios from "axios"
import Item from 'antd/lib/list/Item';
import "./GroupContainer.scss"
function GroupContainer(props) {

    const data = [
        {name : "Phòng Khoa", count: 19},
        {name : "Phòng Đại Học", count: 19},
        {name : "Phòng Tài Chính", count: 19},
        {name : "Phòng CTSV", count: 19},
        {name : "Phòng Bệnh Hơn Chữa Bệnh", count: 19},
        {name : "Phòng Cháy", count: 19},

    ]
    const [ state, setState ] = useState({
        groups: [],
        
    }) 

    const { groups, } = state;
    
    const onGroup = () => {
        console.log("onGroup")
    }

    const RoomNavBadge = props => (
        <div style={{margin: "0.5em", maxWidth: "150px", minWidth: "130px"}}>
                <Badge 
                    className="group-badge"
                    onClick={onGroup}
                    count={props.count}
                    >
                    <div 
                        className="group-badge__text"
                        style={{padding: "1em", borderRadius:"1em", backgroundColor: "#95cbff", fontWeight: "bold"}}
                        >
                        {props.name}
                    </div>
                </Badge>    
        </div>
    )
    const title = props.title || false

    useEffect( () => {
        axios.get("http://localhost:4000/groups/").then(response => {
            if (response.data.code === 200) {
                setState(prev => {
                    return {
                        ...prev,
                        groups : response.data.data.map(group => {
                            return {
                                _id: group._id,
                                name: group.name,
                            }
                        }),
                    }
                })
                console.log(groups)
            }
            else {console.log(response.data.error)}
        })
    }, [])

    return (
        <div style={ title ? { 
            backgroundColor : "white", 
            padding:"1em", 
            border: "2px solid #eeeeee",
            borderTop: "none",
            borderRadius: "0 0 10px 10px"
        } : null}>
            {title && <div> <h3>{title}</h3> <Divider /> </div> }
            <List
                dataSource={state.groups}
                renderItem={item => < RoomNavBadge name={item.name} count={item.count} onClick={onGroup}/>}
            />
        </div>
    );
}

export default GroupContainer;