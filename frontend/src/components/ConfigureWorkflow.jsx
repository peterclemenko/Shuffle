import React, { useState, useEffect } from "react";

import {
  InputAdornment,
  Tooltip,
  TextField,
  CircularProgress,
  ButtonGroup,
  Button,
  Avatar,
  ListItemAvatar,
  Typography,
  List,
  ListItem,
  ListItemText,
  Fade,
} from "@material-ui/core";
import { FavoriteBorder as FavoriteBorderIcon } from "@material-ui/icons";
import { FixName } from "../views/Apps.jsx";

// Handles workflow updates on first open to highlight the issues of the workflow
// Variables
// Action (exists, missing fields)
// Action auth
// Triggers
//
// Specifically used for UNSAVED workflows only?
const ConfigureWorkflow = (props) => {
  const {
    globalUrl,
    theme,
    workflow,
    appAuthentication,
    setSelectedAction,
    setAuthenticationModalOpen,
    setSelectedApp,
    apps,
    selectedAction,
    setConfigureWorkflowModalOpen,
    saveWorkflow,
    newWebhook,
    submitSchedule,
    referenceUrl,
    isCloud,
    setAuthenticationType,
    alert,
		showTriggers,
  } = props;
  const [requiredActions, setRequiredActions] = React.useState([]);
  const [requiredVariables, setRequiredVariables] = React.useState([]);
  const [requiredTriggers, setRequiredTriggers] = React.useState([]);
  const [previousAuth, setPreviousAuth] = React.useState(appAuthentication);
  const [itemChanged, setItemChanged] = React.useState(false);
  const [firstLoad, setFirstLoad] = React.useState("");
  const [showFinalizeAnimation, setShowFinalizeAnimation] = React.useState(false);

  if (workflow === undefined || workflow === null) {
    return null;
  }

  if (apps === undefined || apps === null) {
    return null;
  }

  if (appAuthentication === undefined || appAuthentication === null) {
    return null;
  }

  const getApp = (actionId, appId) => {
    fetch(globalUrl + "/api/v1/apps/" + appId + "/config?openapi=false", {
      headers: {
        Accept: "application/json",
      },
      credentials: "include",
    })
      .then((response) => {
        if (response.status === 200) {
          //alert.success("Successfully GOT app "+appId)
        } else {
          alert.error("Failed getting app");
        }

        return response.json();
      })
      .then((responseJson) => {
        console.log("ACTION: ", responseJson);
        if (
          responseJson.actions !== undefined &&
          responseJson.actions !== null
        ) {
        }
      })
      .catch((error) => {
        alert.error(error.toString());
      });
  };

  if (firstLoad.length === 0 || firstLoad !== workflow.id) {
    if (apps === undefined || apps === null || apps.length === 0) {
      console.log("No apps loaded: ", apps);
      setConfigureWorkflowModalOpen(false);
      return null;
    }

    setFirstLoad(workflow.id)
    const newactions = [];
    for (var key in workflow.actions) {
      const action = workflow.actions[key];
      var newaction = {
        large_image: action.large_image,
        app_name: action.app_name,
        app_version: action.app_version,
        activation_done: false,
        must_activate: false,
        must_authenticate: false,
        auth_done: false,
        action_ids: [],
        action: action,
				update_version: action.app_version,
        app: {},
      };

      const app = apps.find(
        (app) =>
          app.name === action.app_name &&
          (app.app_version === action.app_version ||
            (app.loop_versions !== null &&
              app.loop_versions.includes(action.app_version)))
      );
      if (app === undefined || app === null) {
        //console.log("App not found: ", action.app_name);
          
      	const subapp = apps.find(app => app.name === action.app_name)
				if (subapp !== undefined && subapp !== null) {
					newaction.update_version = "1.1.0"
				}


        newaction.must_activate = true;
      } else {
        if (
          action.authentication_id === "" &&
          app.authentication.required === true
        ) {
          // Check if configuration is filled or not
          var filled = true;
          for (var key in action.parameters) {
            if (action.parameters[key].configuration) {
              //console.log("Found config: ", action.parameters[key])
              if (
                action.parameters[key].value === null ||
                action.parameters[key].value.length === 0
              ) {
                filled = false;
                break;
              }
            }
          }

          if (!filled) {
            newaction.must_authenticate = true;
            newaction.action_ids.push(action.id);
          }
        } else if (action.authentication_id !== "" && app.authentication.required === true) {
					console.log("Should verify authentication ID ", action.authentication_id)

				}

        newaction.app = app;
      }

      if (
        action.errors !== undefined &&
        action.errors !== null &&
        action.errors.length > 0
      ) {
        //console.log("Node has errors!: ", action.errors)
      }

      if (newaction.must_authenticate) {
        var authenticationOptions = [];
        for (var key in appAuthentication) {
          const auth = appAuthentication[key];
          if (auth.app.name === app.name && auth.active) {
            //console.log("Found auth: ", auth)
            authenticationOptions.push(auth);
            newaction.authenticationId = auth.id;
            break;
          }
        }

        if (
          newaction.authenticationId === null ||
          newaction.authenticationId === undefined ||
          newaction.authenticationId.length === ""
        ) {
          //console.log("FAILED to authenticate node!")

          if (
            newactions.find(
              (tmpaction) =>
                tmpaction.app_id === newaction.app_id &&
                tmpaction.app_name === newaction.app_name
            ) !== undefined
          ) {
            //console.log("Action already found.");
          } else {
            newactions.push(newaction);
          }
        } else {
          //console.log("Skipping node as it's already authenticated.")
          newaction.authentication = authenticationOptions;
          workflow.actions[key] = newaction;
        }
      } else if (newaction.must_activate) {
        if (
          newactions.find(
            (tmpaction) =>
              tmpaction.app_id === newaction.app_id &&
              tmpaction.app_name === newaction.app_name
          ) !== undefined
        ) {
          console.log("Action already found.");
        } else {
          newactions.push(newaction);
        }
      }
    }

    for (var key in workflow.workflow_variables) {
      const variable = workflow.workflow_variables[key];
      if (
        variable.value === undefined ||
        variable.value === undefined ||
        variable.value.length < 2
      ) {
        variable.value = "";
        variable.index = key;
        requiredVariables.push(variable);
      }
    }

    for (var key in workflow.triggers) {
      var trigger = workflow.triggers[key];
      trigger.index = key;

      if (trigger.status === "running") {
        continue;
      }

      if (
        trigger.trigger_type === "SUBFLOW" ||
        trigger.trigger_type === "USERINPUT"
      ) {
        continue;
      }

      requiredTriggers.push(trigger);
    }

    if (
      requiredTriggers.length === 0 &&
      requiredVariables.length === 0 &&
      newactions.length === 0
    ) {
      setConfigureWorkflowModalOpen(false);
    }

    setRequiredTriggers(requiredTriggers);
    setRequiredVariables(requiredVariables);
    setRequiredActions(newactions);
	}

  if (appAuthentication.length !== previousAuth.length) {
    var newactions = []
    for (var actionkey in requiredActions) {
      var newaction = requiredActions[actionkey];
      const app = newaction.app;

      for (var key in appAuthentication) {
        const auth = appAuthentication[key];

				// Does this account for all the different ones of the same? 
        if (auth.app.name === app.name && auth.active === true) {
          newaction.auth_done = true;
          break;
        }
      }

      newactions.push(newaction);
    }

    setRequiredActions(newactions);
    setPreviousAuth(appAuthentication);
    // Set auth done to true
    //"auth_done": false
  }

  const TriggerSection = (props) => {
    const { trigger } = props;

    return (
      <ListItem>
        <ListItemAvatar>
          <Avatar variant="rounded">
            <img
              alt={trigger.label}
              src={trigger.large_image}
              style={{ width: 50 }}
            />
          </Avatar>
        </ListItemAvatar>
        <ListItemText
          primary={trigger.name}
          secondary={trigger.description}
          style={{}}
        />
        {trigger.trigger_type === "WEBHOOK" && trigger.status !== "running" ? (
          <Button
            disabled={trigger.status === "running"}
            color="primary"
            variant="contained"
            onClick={() => {
              workflow.triggers[trigger.index].status = "running";
              if (workflow.triggers[trigger.index].parameters === null) {
                workflow.triggers[trigger.index].parameters = [
                  {
                    name: "url",
                    value: referenceUrl + "webhook_" + trigger.id,
                  },
                  { name: "tmp", value: "webhook_" + trigger.id },
                ];
              }

              newWebhook(workflow.triggers[trigger.index]);
              saveWorkflow(workflow);
              setItemChanged(true);
            }}
          >
            {trigger.status !== "running" ? "Start" : "Running"}
          </Button>
        ) : trigger.trigger_type === "SCHEDULE" &&
          trigger.status !== "running" ? (
          <Button
            disabled={trigger.status === "running"}
            color="primary"
            variant="contained"
            onClick={() => {
              workflow.triggers[trigger.index].status = "running";
              if (workflow.triggers[trigger.index].parameters === null) {
                workflow.triggers[trigger.index].parameters = [
                  { name: "cron", value: isCloud ? "*/15 * * * *" : "120" },
                  {
                    name: "execution_argument",
                    value: '{"example": {"json": "is cool"}}',
                  },
                ];
              }

              submitSchedule(workflow.triggers[trigger.index], trigger.index);
              saveWorkflow(workflow);
              setItemChanged(true);
            }}
          >
            {trigger.status !== "running" ? "Start" : "Running"}
          </Button>
        ) : null}
        {/*
					<ListItemText
						primary={
							<TextField
								style={{backgroundColor: theme.palette.inputColor, borderRadius: 5,}} 
								InputProps={{
									style:{
										color: "white",
										minHeight: 50, 
										marginLeft: 5,
										maxWidth: "95%",
										fontSize: "1em",
									},
									endAdornment: (
										<InputAdornment position="end">
										</InputAdornment>
									)
								}}
								fullWidth
								color="primary"
								type={"text"}
								placeholder={`New value for ${trigger.name}`}
								onChange={(event) => {
									console.log("NEW VALUE ON INDEX", trigger.value)
								}}
								onBlur={(event) => {
									//workflow.variables[variable.index] = event.target.value
								}}
							/>
							}
							style={{}}
						/>
						*/}
      </ListItem>
    );
  };

  const VariableSection = (props) => {
    const { variable } = props;

    //<Typography variant="body2">Name: {variable.name} - {variable.value}. </Typography>
    return (
      <ListItem>
        <ListItemAvatar>
          <Avatar>
            <FavoriteBorderIcon />
          </Avatar>
        </ListItemAvatar>
        <ListItemText
          primary={variable.name}
          secondary={variable.description}
          style={{}}
        />
        <ListItemText
          primary={
            <TextField
              style={{
                backgroundColor: theme.palette.inputColor,
                borderRadius: 5,
              }}
              InputProps={{
                style: {
                  color: "white",
                  minHeight: 50,
                  marginLeft: 5,
                  maxWidth: "95%",
                  fontSize: "1em",
                },
                endAdornment: <InputAdornment position="end"></InputAdornment>,
              }}
              fullWidth
              color="primary"
              type={"text"}
              placeholder={`New value for ${variable.name}`}
              onChange={(event) => {
                console.log(
                  "NEW VALUE ON INDEX",
                  variable.index,
                  variable.value
                );
              }}
              onBlur={(event) => {
                workflow.workflow_variables[variable.index].value =
                  event.target.value;
              }}
            />
          }
          style={{}}
        />
      </ListItem>
    );
  };

  const activateApp = (app_id, app_name, app_version) => {
    fetch(
      `${globalUrl}/api/v1/apps/${app_id}/activate?app_name=${app_name}&app_version=${app_version}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
      }
    )
      .then((response) => {
        if (response.status !== 200) {
          //window.location.pathname = "/search"
          //alert.error("Failed to find this app. Is it public?")
        }

        return response.json();
      })
      .then((responseJson) => {
        if (responseJson.success === false) {
        	if (responseJson.reason !== undefined) {
          	alert.error("Failed to activate the app: "+responseJson.reason);
					} else {
          	alert.error("Failed to activate the app");
					}
        } else {
          alert.success("App activated for your organization!");
        }
      })
      .catch((error) => {
        alert.error(error.toString());
      });
  };



  const AppSection = (props) => {
    const { action } = props;

    return (
      <ListItem>
				{/*
        <ListItemAvatar>
          <Avatar variant="rounded">
            <img
              alt={action.app_name}
              src={action.large_image}
              style={{ width: 50 }}
            />
          </Avatar>
        </ListItemAvatar>
        <ListItemText
          primary={FixName(action.app_name)}
          secondary={action.app_version}
          style={{}}
        />
				*/}
        {action.must_authenticate ? 
						<Button
        		  fullWidth
        		  variant="contained"
							disabled={action.auth_done}
        		  style={{
        		    flex: 1,
        		    textTransform: "none",
        		    textAlign: "left",
        		    justifyContent: "flex-start",
        		    backgroundColor: action.auth_done ? theme.palette.surfaceColor : "#ffffff",
        		    color: action.auth_done ? "#686a6c" : "#2f2f2f",
								borderRadius: theme.palette.borderRadius,
								minWidth: 350, 
								maxHeight: 50,
								overflow: "hidden",
								border: `1px solid ${theme.palette.inputColor}`,
        		  }}
        		  color="primary"
        		  onClick={() => {
        		      setAuthenticationType(
                  action.app.authentication.type === "oauth2" &&
                    action.app.authentication.redirect_uri !== undefined &&
                    action.app.authentication.redirect_uri !== null
                    ? {
                        type: "oauth2",
                        redirect_uri: action.app.authentication.redirect_uri,
                        token_uri: action.app.authentication.token_uri,
                        scope: action.app.authentication.scope,
                      }
                    : {
                        type: "",
                      }
                )

                setItemChanged(true);

								if (setSelectedAction !== undefined) {
                	setSelectedAction(action.action);
								}

								if (setSelectedApp !== undefined) {
                	setSelectedApp(action.app);
								}

                setAuthenticationModalOpen(true);
        		  }}
            >
						<img
							alt={action.app_name}
							style={{ margin: 4, minHeight: 30, maxHeight: 30, borderRadius: theme.palette.borderRadius, }}
							src={action.large_image}
						/>
						<Typography style={{ margin: 0, marginLeft: 10 }} variant="body1">
							{action.auth_done ? "Authenticated" : `Authenticate ${action.app_name}`}
						</Typography>
        	</Button>
         : null}
        {action.must_activate ? (
					<Button
        		  fullWidth
        		  variant="contained"
							disabled={action.auth_done}
        		  style={{
        		    flex: 1,
        		    textTransform: "none",
        		    textAlign: "left",
        		    justifyContent: "flex-start",
        		    backgroundColor: action.auth_done ? theme.palette.surfaceColor : "#ffffff",
        		    color: action.auth_done ? "#686a6c" : "#2f2f2f",
								borderRadius: theme.palette.borderRadius,
								minWidth: 350, 
								maxHeight: 50,
								overflow: "hidden",
								border: `1px solid ${theme.palette.inputColor}`,
        		  }}
        		  color="primary"
        		  onClick={() => {
								console.log("ACTION: ", action)
								activateApp(action.action.app_id, action.app_name, action.app_version);
								setItemChanged(true);
            	}}
          >
						<img
							alt={action.app_name}
							style={{ margin: 4, minHeight: 30, maxHeight: 30, borderRadius: theme.palette.borderRadius, }}
							src={action.large_image}
						/>
						<Typography style={{ margin: 0, marginLeft: 10 }} variant="body1">
							Activate
						</Typography>
          </Button>
        ) : null}
				{action.update_version !== action.app_version ? (
          <Button
						fullWidth
						variant="contained"
						disabled={action.auth_done}
						style={{
							flex: 1,
							textTransform: "none",
							textAlign: "left",
							justifyContent: "flex-start",
							backgroundColor: action.auth_done ? theme.palette.surfaceColor : "#ffffff",
							color: action.auth_done ? "#686a6c" : "#2f2f2f",
							borderRadius: theme.palette.borderRadius,
							minWidth: 350, 
							maxHeight: 50,
							overflow: "hidden",
							border: `1px solid ${theme.palette.inputColor}`,
						}}
						color="primary"
						onClick={() => {
							console.log("Set version to: ", action.update_version)

							if (workflow.actions !== null) {
								//console.log(workflow.actions)
								alert.info("Setting action to version "+action.update_version)
								for (var key in workflow.actions) {
									if (workflow.actions[key].app_name === action.app_name && workflow.actions[key].app_version === action.app_version) {
										workflow.actions[key].app_version = action.update_version

										if (!itemChanged) {
											setItemChanged(true)
										}
									}
								}

								action.must_activate = false
								action.update_version = action.app_version
							}
            }}
          >
						<img
							alt={action.app_name}
							style={{ margin: 4, minHeight: 30, maxHeight: 30, borderRadius: theme.palette.borderRadius, }}
							src={action.large_image}
						/>
						<Typography style={{ margin: 0, marginLeft: 10 }} variant="body1">
							{action.update_version}
						</Typography>
          </Button>
        ) : null}
      </ListItem>
    );
  }
									
	// Based on the color here. Default: #f86a3e
	//backgroundColor: selectedUsecaseCategory === usecase.name ? usecase.color : theme.palette.surfaceColor,

	const topColor = "#f86a3e, #fc3922"
  return (
    <div>
			<div style={{height: 125, width: "100%", background: `linear-gradient(to right, ${topColor}`, position: "relative",}}>
			</div>
			<div style={{margin: "25px 50px 50px 50px", maxHeight: 475, }}>
      	<Typography variant="h6">{workflow.name}</Typography>
      	<Typography variant="body2" color="textSecondary">
      	  The following configuration makes the workflow ready immediately.
      	</Typography>
      	{requiredActions.length > 0 ? (
      	  <span>
      	    <Typography variant="body1" style={{ marginTop: 10 }}>
      	      Required Actions
      	    </Typography>
      	    <List>
      	      {requiredActions.map((data, index) => {
      	        return (
									<AppSection key={index} action={data} />
								)
      	      })}
      	    </List>
      	  </span>
      	) : null}

      	{requiredVariables.length > 0 ? (
      	  <span>
      	    <Typography variant="body1" style={{ marginTop: 10 }}>
      	      Variables
      	    </Typography>
      	    <List>
      	      {requiredVariables.map((data, index) => {
      	        return <VariableSection key={index} variable={data} />;
      	      })}
      	    </List>
      	  </span>
      	) : null}

      	{requiredTriggers.length > 0 && showTriggers !== false ? (
      	  <span>
      	    <Typography variant="body1" style={{ marginTop: 10 }}>
      	      Triggers
      	    </Typography>
      	    <List>
      	      {requiredTriggers.map((data, index) => {
      	        return <TriggerSection key={index} trigger={data} />;
      	      })}
      	    </List>
      	  </span>
      	) : null}

				<div style={{ textAlign: "center", display: "flex", marginTop: 20 }}>
					{showFinalizeAnimation ? 
						<img id="finalize_gif" src="/images/finalize.gif" alt="finalize workflow animation" style={{width: 150, margin: "auto",}} onLoad={() => {
							console.log("Img loaded.")
							setTimeout(() => {
								console.log("Img closing.")
								setConfigureWorkflowModalOpen(false);
							}, 1250)
								
						}}/>
						:
						<ButtonGroup style={{ margin: "auto" }}>
							{/*
							<Button color="primary" variant={"outlined"} style={{
							}} onClick={() => {
								setConfigureWorkflowModalOpen(false)
							}}>
								Skip 
							</Button>
							*/}
							<Button
								color="textSecondary"
								variant={"outlined"}
								style={{}}
								onClick={() => {
									setShowFinalizeAnimation(true)
									setTimeout(() => {
										if (itemChanged) {
											if (saveWorkflow !== undefined) {
												saveWorkflow(workflow);
												window.location.reload();
											}

										} else {
										}
									}, 1000)
								}}
							>
								Finalize	
							</Button>
						</ButtonGroup>
					}
				</div>
			</div>
    </div>
  );
};

export default ConfigureWorkflow;
