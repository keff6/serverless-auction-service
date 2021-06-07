import AWS from 'aws-sdk'

const dynamodb = new AWS.DynamoDB.DocumentClient()
const sqs = new AWS.SQS()

export async function closeAuction(auction) {
  const params = {
    TableName: process.env.AUCTIONS_TABLE_NAME,
    Key: { id: auction.id },
    UpdateExpression: 'set #status = :status',
    ExpressionAttributeValues: {
      ':status': 'CLOSED',
    },
    ExpressionAttributeNames: {
      '#status': 'status',
    },
  }

  const result = await dynamodb.update(params).promise()

  const { title, seller, highestBid } = auction
  const { amount, bidder } = highestBid
  const hasBids = amount > 0

  if(!hasBids) {
    await sqs.sendMessage({
      QueueUrl: process.env.MAIL_QUEUE_URL,
      MessageBody: JSON.stringify({
        subject: `Nobody bid for ${title}, bid ended`,
        recipient: seller,
        body: `Nobody bid for ${title}, bid ended`,
      }),
    })
    return
  }

  const notifySeller = sqs.sendMessage({
    QueueUrl: process.env.MAIL_QUEUE_URL,
    MessageBody: JSON.stringify({
      subject: `${title} bid ended`,
      recipient: seller,
      body: `Your item ${title} has been sold for ${amount}`,
    }),
  }).promise()

  const notifyBidder = sqs.sendMessage({
    QueueUrl: process.env.MAIL_QUEUE_URL,
    MessageBody: JSON.stringify({
      subject: `You won ${title} bid!`,
      recipient: bidder,
      body: 'You won can you believe it!!',
    }),
  }).promise()

  return Promise.all([notifySeller, notifyBidder]);
}