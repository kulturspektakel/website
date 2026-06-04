import {prismaClient} from '../../../utils/prismaClient.server';
import {ApiError} from '../../../utils/apiError.server';
import {postResponseUrl} from '../../../utils/slack.server';
import {generateTwoFactorCodeResponse} from './twofactor';
import {
  assignCrewCard,
  showCrewCardAssignmentModal,
} from './crewCardEnrollment';

/**
 * Migrated from `~/api.kulturspektakel.de/src/routes/slack/interaction.ts`.
 *
 * Slack interactivity webhook. Slack POSTs `application/x-www-form-urlencoded`
 * with a `payload` field (JSON). Handles button clicks (block_actions) and modal
 * submissions (view_submission). The obsolete `nuclino-login-*` actions are
 * dropped (replaced by the `/nuclino-sso` page).
 */

type SlackInteractionPayload = {
  trigger_id: string;
  user: {id: string; username: string; name: string};
};

type SlackButtonAction = {
  type: 'button';
  action_id:
    | 'approve-nonce-request'
    | 'reject-nonce-request'
    | 'two-factor-code'
    | 'assign-crew-card-modal'
    | 'nuclino-login-open';
  value?: string;
};

type SlackUserSelectAction = {
  type: 'users_select';
  action_id: 'users_select-action';
  selected_user: string;
};

type SlackBlockActionPayload = SlackInteractionPayload & {
  type: 'block_actions';
  actions: Array<SlackButtonAction | SlackUserSelectAction>;
  response_url: string;
};

type SlackViewSubmissionPayload = SlackInteractionPayload & {
  type: 'view_submission';
  view: {
    private_metadata?: string;
    callback_id: string;
    state: {
      values: {
        [block: string]: {
          [action: string]:
            | {type: 'plain_text_input'; value: string}
            | {type: 'users_select'; selected_user: string};
        };
      };
    };
  };
};

const ok = () => new Response(null, {status: 200});

export async function handleSlackInteraction(
  request: Request,
): Promise<Response> {
  const form = await request.formData();
  const raw = form.get('payload');
  if (typeof raw !== 'string') {
    throw new ApiError(400, 'Missing payload');
  }
  let payload: SlackBlockActionPayload | SlackViewSubmissionPayload;
  try {
    payload = JSON.parse(raw);
  } catch (e) {
    throw new ApiError(400, 'Invalid payload', e as Error);
  }

  switch (payload.type) {
    case 'block_actions': {
      const [action] = payload.actions ?? [];
      switch (action?.action_id) {
        case 'approve-nonce-request':
        case 'reject-nonce-request': {
          await prismaClient.nonceRequest.update({
            where: {id: action.value, expiresAt: {gt: new Date()}},
            data: {
              status:
                action.action_id === 'approve-nonce-request'
                  ? 'Approved'
                  : 'Rejected',
            },
          });
          await postResponseUrl(payload.response_url, {delete_original: 'true'});
          return ok();
        }
        case 'two-factor-code': {
          if (!action.value) {
            throw new ApiError(400, 'Invalid input');
          }
          const parts = action.value.split('@');
          const service = parts.pop();
          const account = parts.join('@');
          const twoFactor = await prismaClient.twoFactor.findFirstOrThrow({
            where: {service, account},
          });
          const response = await generateTwoFactorCodeResponse(
            payload.user.id,
            twoFactor,
          );
          await postResponseUrl(payload.response_url, {
            replace_original: 'true',
            ...response,
          });
          return ok();
        }
        case 'assign-crew-card-modal': {
          if (!action.value) {
            throw new ApiError(400, 'Invalid input');
          }
          await showCrewCardAssignmentModal(
            action.value,
            payload.trigger_id,
            payload.response_url,
          );
          return ok();
        }
        // The /nuclino modal button is a url button; clicking it also fires an
        // interaction we just ack (the url opens the login redirect itself).
        case 'nuclino-login-open':
        case 'users_select-action':
          return ok();
        default:
          console.error('Unknown action', action);
          return ok();
      }
    }
    case 'view_submission': {
      if (payload.view.callback_id === 'assign-crew-card') {
        const values = Object.values(payload.view.state.values).flatMap(
          Object.values,
        );
        const slackUserId = values.find(
          (v) => v.type === 'users_select',
        )?.selected_user;
        const nonSlackUser = values.find(
          (v) => v.type === 'plain_text_input',
        )?.value;

        await assignCrewCard(
          slackUserId,
          nonSlackUser,
          payload.user.id,
          payload.view.private_metadata!,
        );
        return Response.json({response_action: 'clear'});
      }
      console.error('Unknown view_submission', payload.view.callback_id);
      return ok();
    }
    default:
      console.error('Unknown payload', payload);
      return ok();
  }
}
