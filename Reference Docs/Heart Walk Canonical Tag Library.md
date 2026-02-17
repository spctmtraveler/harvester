# DB Seed — Heart Walk Canonical Tags v1.0 (Markdown Tables)

This document defines the canonical tag library the parsing AI must use to tag all sentences and derived insights. New tags are not allowed.

To accomplish this, we include one tag for text that is not relevant to Heart Walk operations, and one tag for text that is relevant but does not fit any existing canonical tag. Prefer assigning specific canonical tags whenever possible rather than defaulting to `miscellaneous`. At least one tag below is required for each sentence, and all applicable tags should be included.

* `tag_category`
* `tag`

---

## Table: tag_category

| category_id | category_key | category_name | description                                                        |
| ----------: | ------------ | ------------- | ------------------------------------------------------------------ |
|           1 | roles        | Roles         | Canonical role titles used in Heart Walk operations                |
|           2 | groups       | Groups        | Canonical organizations/teams/collectives in the Heart Walk system |
|           3 | meetings     | Meetings      | Canonical meeting/event types                                      |
|           4 | tools_docs   | Tools/Docs    | Canonical systems, tools, and documents                            |
|           5 | actions      | Actions       | High-level action buckets (cross-organization)                     |
|           6 | org_tags     | Org Tags      | General organizational tags (cross-domain)                         |
|           7 | catch_all    | Catch-All     | Required catch-all tags                                            |

---

## Table: tag

**Columns**

* `tag_id`: stable numeric ID (can be replaced by UUID later)
* `tag_key`: machine-safe key (authoritative value for model output)
* `tag_name`: human-friendly canonical label
* `category_key`: foreign key by key (or map to category_id)
* `is_canonical`: always true for allowed tags
* `notes`: brief intent/definition

**Hard rules**

* `tag_key` is the source-of-truth token for AI output and storage.
* `tag_name` is display text only.
* `catch_miscellaneous` and `catch_irrelevant` are exclusive single-tag outcomes. If either is used, no additional tags may be assigned to that sentence.

| tag_id | tag_key                           | tag_name                                     | category_key | is_canonical | notes                                      |
| -----: | --------------------------------- | -------------------------------------------- | ------------ | :----------: | ------------------------------------------ |
|   1001 | role_executive_director           | Executive Director (ED)                      | roles        |     TRUE     | Internal AHA staff role                    |
|   1002 | role_development_director         | Development Director (DD)                    | roles        |     TRUE     | Internal AHA staff role                    |
|   1003 | role_senior_development_director  | Senior Development Director                  | roles        |     TRUE     | Internal AHA staff role                    |
|   1004 | role_vice_president               | Vice President (VP)                          | roles        |     TRUE     | Internal AHA staff role                    |
|   1005 | role_senior_vice_president        | Senior Vice President (SVP)                  | roles        |     TRUE     | Internal AHA staff role                    |
|   1006 | role_consultant                   | Consultant                                   | roles        |     TRUE     | Internal AHA support/strategy role         |
|   1007 | role_national_staff               | National Staff                               | roles        |     TRUE     | Internal AHA national team member          |
|   1101 | role_elt_chair                    | ELT Chair                                    | roles        |     TRUE     | External volunteer leader                  |
|   1102 | role_elt_member                   | ELT Member                                   | roles        |     TRUE     | External volunteer leader                  |
|   1103 | role_market_board_member          | Market Board Member                          | roles        |     TRUE     | External volunteer governance/leadership   |
|   1104 | role_corporate_executive          | Corporate Executive                          | roles        |     TRUE     | External corporate leader                  |
|   1105 | role_executive_assistant          | Executive Assistant                          | roles        |     TRUE     | External corporate gatekeeper role         |
|   1106 | role_team_captain                 | Team Captain                                 | roles        |     TRUE     | External volunteer/team leader             |
|   1107 | role_participant_walker           | Participant / Walker                         | roles        |     TRUE     | Campaign participant                       |
|   2001 | group_aha_national                | AHA National                                 | groups       |     TRUE     | National-level org unit                    |
|   2002 | group_aha_market                  | AHA Market (Local Office)                    | groups       |     TRUE     | Local operating unit                       |
|   2003 | group_elt                         | ELT (Executive Leadership Team)              | groups       |     TRUE     | Volunteer executive leadership group       |
|   2004 | group_market_board                | Market Board                                 | groups       |     TRUE     | Volunteer governance/advisory group        |
|   2005 | group_volunteer_leadership        | Volunteer Leadership (general)               | groups       |     TRUE     | Non-staff leaders (umbrella)               |
|   2006 | group_internal_staff              | Internal Staff (general)                     | groups       |     TRUE     | Paid AHA staff (umbrella)                  |
|   2007 | group_participant_company         | Participant Company                          | groups       |     TRUE     | Company participating via sponsorship/team |
|   2008 | group_corporate_prospect          | Corporate Prospect                           | groups       |     TRUE     | Company/lead being pursued                 |
|   2009 | group_sponsor                     | Sponsor                                      | groups       |     TRUE     | Sponsoring entity                          |
|   2010 | group_team                        | Team (company team)                          | groups       |     TRUE     | Employee fundraising team                  |
|   3001 | meeting_elt_meeting               | ELT Meeting                                  | meetings     |     TRUE     | Volunteer leadership meeting               |
|   3002 | meeting_gap_meeting               | GAP Meeting                                  | meetings     |     TRUE     | Targets vs pipeline review                 |
|   3003 | meeting_strategy_meeting          | Strategy Meeting                             | meetings     |     TRUE     | Planning/strategy discussion               |
|   3004 | meeting_orientation_onboarding    | Orientation / Onboarding Meeting             | meetings     |     TRUE     | Role start / context meeting               |
|   3005 | meeting_internal_coordination     | Internal Coordination Meeting                | meetings     |     TRUE     | Staff alignment/coordination meeting       |
|   3006 | meeting_exec_networking_breakfast | Executive Networking Breakfast               | meetings     |     TRUE     | Recruiting meal event for execs            |
|   4001 | tool_salesforce                   | Salesforce                                   | tools_docs   |     TRUE     | CRM/pipeline tracking system               |
|   4002 | tool_sharepoint                   | SharePoint                                   | tools_docs   |     TRUE     | Resource repository/document hub           |
|   4003 | tool_reporting_dashboard          | Reporting Dashboard                          | tools_docs   |     TRUE     | Reporting/metrics view                     |
|   4101 | doc_impact_plan                   | Impact Plan                                  | tools_docs   |     TRUE     | Commitment/next-step capture artifact      |
|   4102 | doc_pipeline_tracker              | Pipeline Tracker / Spreadsheet               | tools_docs   |     TRUE     | Spreadsheet tracking for pipeline/status   |
|   4103 | doc_planning_document             | Planning Document / Planner                  | tools_docs   |     TRUE     | Planning artifact                          |
|   4201 | doc_volunteer_job_description     | Job Description (Volunteer Role Description) | tools_docs   |     TRUE     | Volunteer role expectations                |
|   4202 | doc_annotated_agenda              | Annotated Agenda                             | tools_docs   |     TRUE     | Agenda with talk tracks/talking points     |
|   4203 | doc_slide_deck                    | Slide Deck                                   | tools_docs   |     TRUE     | Presentation deck                          |
|   4204 | doc_email_template                | Email Template                               | tools_docs   |     TRUE     | Copy/paste outreach email                  |
|   4205 | doc_call_script                   | Call Script                                  | tools_docs   |     TRUE     | Script/talk track for calls                |
|   4206 | doc_text_template                 | Text Template                                | tools_docs   |     TRUE     | Short SMS-style messaging template         |
|   5001 | action_recruit                    | Recruit                                      | actions      |     TRUE     | Recruit people/volunteers/leaders          |
|   5002 | action_onboard                    | Onboard                                      | actions      |     TRUE     | Initial setup / role start                 |
|   5003 | action_orient                     | Orient                                       | actions      |     TRUE     | Role expectations / context                |
|   5004 | action_train                      | Train                                        | actions      |     TRUE     | Skill-building / coaching                  |
|   5005 | action_engage                     | Engage                                       | actions      |     TRUE     | Activate/retain involvement                |
|   5006 | action_prospect                   | Prospect                                     | actions      |     TRUE     | Identify targets/accounts/leads            |
|   5007 | action_cultivate                  | Cultivate                                    | actions      |     TRUE     | Relationship-building pre-ask              |
|   5008 | action_solicit                    | Solicit                                      | actions      |     TRUE     | Make donation/sponsorship ask              |
|   5009 | action_close                      | Close                                        | actions      |     TRUE     | Secure commitment / finalize               |
|   5010 | action_follow_up                  | Follow-Up                                    | actions      |     TRUE     | Post-ask / post-meeting loop               |
|   5011 | action_track                      | Track                                        | actions      |     TRUE     | Update status/pipeline/tasks               |
|   5012 | action_coordinate                 | Coordinate                                   | actions      |     TRUE     | Align work; avoid collisions               |
|   5013 | action_steward                    | Steward                                      | actions      |     TRUE     | Post-gift relationship maintenance         |
|   5014 | action_recognize                  | Recognize                                    | actions      |     TRUE     | Thanks/awards/public recognition           |
|   5015 | action_communicate                | Communicate                                  | actions      |     TRUE     | Broadcast updates; targeted outreach       |
|   5016 | action_plan                       | Plan                                         | actions      |     TRUE     | Planning/strategy/goal-setting             |
|   5017 | action_convene                    | Convene                                      | actions      |     TRUE     | Hold/organize meetings/events              |
|   6001 | org_accountability                | Accountability                               | org_tags     |     TRUE     | Accountability mechanisms/norms            |
|   6002 | org_ownership                     | Ownership                                    | org_tags     |     TRUE     | Relationship/account ownership             |
|   6003 | org_decision_making               | Decision-Making                              | org_tags     |     TRUE     | How decisions are made                     |
|   6004 | org_governance                    | Governance                                   | org_tags     |     TRUE     | Governance structures/processes            |
|   6005 | org_incentives                    | Incentives                                   | org_tags     |     TRUE     | Incentives, rewards, consequences          |
|   6006 | org_motivation                    | Motivation                                   | org_tags     |     TRUE     | Motivation/engagement drivers              |
|   6007 | org_communication                 | Communication                                | org_tags     |     TRUE     | Communication practices                    |
|   6008 | org_reporting                     | Reporting                                    | org_tags     |     TRUE     | Reporting systems/practices                |
|   6009 | org_data_hygiene                  | Data Hygiene                                 | org_tags     |     TRUE     | Data quality/updates/completeness          |
|   6010 | org_workflow                      | Workflow                                     | org_tags     |     TRUE     | Workflow sequencing/routines               |
|   6011 | org_process                       | Process                                      | org_tags     |     TRUE     | Processes/standard operating patterns      |
|   6012 | org_resource_allocation           | Resource Allocation                          | org_tags     |     TRUE     | Allocation of time/staff/budget            |
|   6013 | org_capacity_bandwidth            | Capacity / Bandwidth                         | org_tags     |     TRUE     | Time/energy constraints                    |
|   6014 | org_time_scheduling               | Time / Scheduling                            | org_tags     |     TRUE     | Scheduling constraints/cadence             |
|   6015 | org_relationship_management       | Relationship Management                      | org_tags     |     TRUE     | Relationship management norms              |
|   7001 | catch_miscellaneous               | miscellaneous                                | catch_all    |     TRUE     | Relevant but no canonical tag fits         |
|   7002 | catch_irrelevant                  | irrelevant                                   | catch_all    |     TRUE     | Not relevant to HW operations              |

---

## Seed for sentence booleans (not tags)

These should be boolean columns on `Sentence` and `Insight`. They are not mutually exclusive. At least 1 should be checked for every sentence that is not removed as irrelevant:

* is_problem | If the string includes a complaint about an existing problem
* is_solution | If the string includes an idea for improvement
* is_explanation | If the string has some portion that helps researchers/AI understand the context
* is_workaround | If the string describes a workaround for something broken
