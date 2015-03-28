/**
@module ember
@submodule ember-htmlbars
*/

import Ember from "ember-metal/core"; // Handlebars, uuid, FEATURES, assert, deprecate
import { get } from "ember-metal/property_get";
import { uuid } from "ember-metal/utils";
import run from "ember-metal/run_loop";
import { readUnwrappedModel } from "ember-views/streams/utils";
import { isSimpleClick } from "ember-views/system/utils";
import ActionManager from "ember-views/system/action_manager";

export default {
  setupState: function(state, env, scope, params, hash) {
    var getStream = env.hooks.get;
    var read = env.hooks.getValue;

    var actionName = read(params[0]);

    Ember.assert("You specified a quoteless path to the {{action}} helper " +
                 "which did not resolve to an action name (a string). " +
                 "Perhaps you meant to use a quoted actionName? (e.g. {{action 'save'}}).",
                 typeof actionName === 'string');

    var actionArgs = [];
    for (var i = 1, l = params.length; i < l; i++) {
      actionArgs.push(readUnwrappedModel(params[i]));
    }

    var target;
    if (hash.target) {
      if (typeof hash.target === 'string') {
        target = read(getStream(env, scope, hash.target));
      } else {
        target = read(hash.target);
      }
    } else {
      target = get(env.view, 'controller');
    }

    return { actionName, actionArgs, target };
  },

  isStable: function(state, env, scope, params, hash) {
    return true;
  },

  render: function(node, env, scope, params, hash, template, inverse, visitor) {
    var actionId = ActionHelper.registerAction({
      node: node,
      eventName: hash.on || "click",
      bubbles: hash.bubbles,
      preventDefault: hash.preventDefault,
      withKeyCode: hash.withKeyCode,
      allowedKeys: hash.allowedKeys
    });

    node.cleanup = function() {
      ActionHelper.unregisterAction(actionId);
    };

    env.dom.setAttribute(node.element, 'data-ember-action', actionId);
  }
};

export var ActionHelper = {};

// registeredActions is re-exported for compatibility with older plugins
// that were using this undocumented API.
ActionHelper.registeredActions = ActionManager.registeredActions;

ActionHelper.registerAction = function({ node, eventName, preventDefault, bubbles, allowedKeys }) {
  var actionId = uuid();

  ActionManager.registeredActions[actionId] = {
    eventName,
    handler(event) {
      if (!isAllowedEvent(event, allowedKeys)) {
        return true;
      }

      if (preventDefault !== false) {
        event.preventDefault();
      }

      if (bubbles === false) {
        event.stopPropagation();
      }

      let { target, actionName, actionArgs } = node.state;

      run(function runRegisteredAction() {
        if (target.send) {
          target.send.apply(target, [actionName, ...actionArgs]);
        } else {
          Ember.assert(
            "The action '" + actionName + "' did not exist on " + target,
            typeof target[actionName] === 'function'
          );

          target[actionName].apply(target, actionArgs);
        }
      });
    }
  };

  return actionId;
};

ActionHelper.unregisterAction = function(actionId) {
  delete ActionManager.registeredActions[actionId];
};

var MODIFIERS = ["alt", "shift", "meta", "ctrl"];
var POINTER_EVENT_TYPE_REGEX = /^click|mouse|touch/;

function isAllowedEvent(event, allowedKeys) {
  if (typeof allowedKeys === "undefined") {
    if (POINTER_EVENT_TYPE_REGEX.test(event.type)) {
      return isSimpleClick(event);
    } else {
      allowedKeys = '';
    }
  }

  if (allowedKeys.indexOf("any") >= 0) {
    return true;
  }

  for (var i=0, l=MODIFIERS.length;i<l;i++) {
    if (event[MODIFIERS[i] + "Key"] && allowedKeys.indexOf(MODIFIERS[i]) === -1) {
      return false;
    }
  }

  return true;
}
