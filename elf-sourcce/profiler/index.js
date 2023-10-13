/*********************************************************************************************************************
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
 *                                                                                                                    *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/LICENSE-2.0                                                                    *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/

const { DynamoDBDocument } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const error = require('./lib/error.js');

exports.handler = async (event) => {
    console.log(`REQUEST:: ${JSON.stringify(event, null, 2)}`);

    const dynamo = DynamoDBDocument.from(new DynamoDBClient({ 
        region: process.env.AWS_REGION,
        customUserAgent: process.env.SOLUTION_IDENTIFIER
    }));

    try {
        // Download DynamoDB data for the source file:
        let params = {
            TableName: process.env.DynamoDBTable,
            Key: {
                guid: event.guid
            }
        };

        let data = await dynamo.get(params);
        console.log(`data:: ${JSON.stringify(data, null, 2)}`);
        Object.keys(data.Item).forEach(key => {
            event[key] = data.Item[key];
        });

        let mediaInfo = JSON.parse(event.srcMediainfo);
        event.srcHeight = mediaInfo.video[0].height;
        event.srcWidth = mediaInfo.video[0].width;
        event.rotation = mediaInfo.video[0].rotation;//added rotation

        // added
        // Determine a video is vertical or not 
        // 1.rotation = 0 or 180 and height >  width
        // 2.rotation = 90 or 270 and height <  width
        let isVertical = false;
        if (((event.rotation == 0 || event.rotation == 180) && event.srcHeight > event.srcWidth)
        ||((event.rotation == 90 || event.rotation == 270) && event.srcHeight < event.srcWidth)) {
            isVertical = true;
        }
        event.isVertical = isVertical;


        // Choose the template for videos 
        // horizontal videos (remain the same as VoD template)
        // Determine encoding by matching the srcHeight to the nearest profile.
        let encodeProfile = 720;
        let height = 720;
        let width = 1280;

        let jobTemplates = {
            '720': event.jobTemplate_720p
        };
        if (isVertical) {
            height = 1280;
            width = 720;
            jobTemplates = {
                '720': event.jobTemplate_720p_vertical
            }
        }
        event.encodingProfile = encodeProfile;
        event.frameCaptureHeight = height;
            event.frameCaptureWidth = width;
            event.jobTemplate = jobTemplates[encodeProfile];
                        event.isCustomTemplate = false;
        console.log(`Chosen template:: ${event.jobTemplate}`);
    } catch (err) {
        await error.handler(event, err);
        throw err;
    }

    console.log(`RESPONSE:: ${JSON.stringify(event, null, 2)}`);
    return event;
};
