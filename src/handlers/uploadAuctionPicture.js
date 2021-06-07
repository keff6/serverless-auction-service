import middy from '@middy/core'
import httpErrorHandler from '@middy/http-error-handler'
import createError from 'http-errors'
import validator from '@middy/validator'
import { getAuctionById } from './getAuction'
import { uploadPictureToS3 } from '../lib/uploadPictureToS3'
import { setAuctionPictureUrl } from '../lib/setAuctionPictureUrl'
import uploadAuctionPictureSchema from '../lib/schemas/uploadAuctionPictureSchema'


export async function uploadAuctionPicture(event) {
  const { id } = event.pathParameters
  const auction = await getAuctionById(id)
  const { email } = event.requestContext.authorizer

  if(email !== auction.seller) {
    throw new createError.Forbidden('You are not the seller')
  }

  const base64 = event.body.replace(/^data"image\/\w+;base64,/, '')
  const buffer = Buffer.from(base64, 'base64')
  let updatedAuction = {}

  try {
    const pictureUrl = await uploadPictureToS3(auction.id + '.jpg', buffer)
    // send to dynamo db as pictureUrl
    updatedAuction = await setAuctionPictureUrl(auction.id, pictureUrl)
  } catch (error) {
    console.log(error)
    throw new createError.InternalServerError(error)
  }

  return {
    statusCode: 200,
    body: JSON.stringify(updatedAuction),
  }
}

export const handler = middy(uploadAuctionPicture)
  .use(validator({ inputSchema: uploadAuctionPictureSchema }))
  .use(httpErrorHandler())