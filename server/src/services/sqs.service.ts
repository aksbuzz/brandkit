// import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
// import { config } from '../config';

// const sqsClient = new SQSClient({ region: config.aws.region });

// export const sendDeleteMessage = async (assetId: string): Promise<void> => {
//   const command = new SendMessageCommand({
//     QueueUrl: config.aws.sqs.deleteQueueUrl,
//     MessageBody: JSON.stringify({ assetId }),
//   });

//   await sqsClient.send(command);
// };
